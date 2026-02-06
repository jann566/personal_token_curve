// programs/hub_mm/src/lib.rs

use anchor_lang::prelude::*;

pub mod registry;
pub use registry::*;

use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer},
};

declare_id!("BkG5yURdmMvDdHYJSZ7EYCgVnHVAs3hK8ppakVVqvwZL");

#[program]
pub mod hub_mm {
    use super::*;

    pub fn init_market(
        ctx: Context<InitMarket>,
        v_base: u128,
        v_token: u128,
        fee_bps: u16,
        protocol_fee_share_bps: u16,
    ) -> Result<()> {
        // Debug: log incoming parameters to help diagnose InvalidReserves reverts
        msg!("init_market called with v_base={} v_token={} fee_bps={} protocol_fee_share_bps={}", v_base, v_token, fee_bps, protocol_fee_share_bps);
        msg!("init_market accounts: admin={} mint={} base_mint={}", ctx.accounts.admin.key(), ctx.accounts.mint.key(), ctx.accounts.base_mint.key());
        require!(v_base > 0 && v_token > 0, HubError::InvalidReserves);
        require!(fee_bps <= 10_000, HubError::InvalidBps);
        require!(protocol_fee_share_bps <= 10_000, HubError::InvalidBps);

        let market = &mut ctx.accounts.market;
        market.admin = ctx.accounts.admin.key();
        market.mint = ctx.accounts.mint.key();
        market.base_mint = ctx.accounts.base_mint.key();
        market.treasury_base_ata = ctx.accounts.treasury_base_ata.key();
        market.admin_fee_ata = ctx.accounts.admin_fee_ata.key();

        market.v_base = v_base;
        market.v_token = v_token;

        market.fee_bps = fee_bps;
        market.protocol_fee_share_bps = protocol_fee_share_bps;

        market.is_paused = false;

        market.bump = ctx.bumps.market;
        market.treasury_bump = ctx.bumps.treasury_authority;

        Ok(())
    }

    pub fn swap_buy(ctx: Context<SwapBuy>, base_in: u64, min_token_out: u64) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(!market.is_paused, HubError::MarketPaused);
        require!(base_in > 0, HubError::InvalidAmount);

        require_keys_eq!(
            ctx.accounts.base_mint.key(),
            market.base_mint,
            HubError::InvalidMint
        );
        require_keys_eq!(ctx.accounts.mint.key(), market.mint, HubError::InvalidMint);

        let fee_bps = market.fee_bps as u128;
        let protocol_share = market.protocol_fee_share_bps as u128;

        let base_in_u128 = base_in as u128;

        // total_fee = base_in * fee_bps / 10000
        let total_fee = base_in_u128
            .checked_mul(fee_bps)
            .ok_or(HubError::MathOverflow)?
            .checked_div(10_000)
            .ok_or(HubError::MathOverflow)?;

        let base_effective = base_in_u128
            .checked_sub(total_fee)
            .ok_or(HubError::MathOverflow)?;

        // protocol_fee = total_fee * protocol_share / 10000
        let protocol_fee = total_fee
            .checked_mul(protocol_share)
            .ok_or(HubError::MathOverflow)?
            .checked_div(10_000)
            .ok_or(HubError::MathOverflow)?;

        // everything except protocol_fee goes to treasury (includes non-protocol part of fee)
        let to_treasury = base_in_u128
            .checked_sub(protocol_fee)
            .ok_or(HubError::MathOverflow)?;

        // CPMM math using virtual reserves
        let v_base = market.v_base;
        let v_token = market.v_token;

        let k = v_base.checked_mul(v_token).ok_or(HubError::MathOverflow)?;

        let v_base_new = v_base
            .checked_add(base_effective)
            .ok_or(HubError::MathOverflow)?;

        let v_token_new = k.checked_div(v_base_new).ok_or(HubError::MathOverflow)?;

        let token_out_u128 = v_token
            .checked_sub(v_token_new)
            .ok_or(HubError::MathOverflow)?;

        require!(token_out_u128 > 0, HubError::ZeroOut);

        require!(
            token_out_u128 >= min_token_out as u128,
            HubError::SlippageExceeded
        );

        // 1) Transfer protocol fee -> admin fee vault
        if protocol_fee > 0 {
            let cpi_accounts = Transfer {
                from: ctx.accounts.user_base_ata.to_account_info(),
                to: ctx.accounts.admin_fee_ata.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            };
            let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
            token::transfer(cpi_ctx, protocol_fee as u64)?;
        }

        // 2) Transfer remaining -> treasury
        {
            let cpi_accounts = Transfer {
                from: ctx.accounts.user_base_ata.to_account_info(),
                to: ctx.accounts.treasury_base_ata.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            };
            let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
            token::transfer(cpi_ctx, to_treasury as u64)?;
        }

        // 3) Mint token_out to user (PDA signs)
        {
            let market_key = market.key();
            let seeds: &[&[u8]] = &[
                b"treasury_authority",
                market_key.as_ref(),
                &[market.treasury_bump],
            ];
            let signer = &[seeds];

            let cpi_accounts = MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.user_token_ata.to_account_info(),
                authority: ctx.accounts.treasury_authority.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer,
            );
            token::mint_to(cpi_ctx, token_out_u128 as u64)?;
        }

        market.v_base = v_base_new;
        market.v_token = v_token_new;

        Ok(())
    }

    pub fn swap_sell(ctx: Context<SwapSell>, token_in: u64, min_base_out: u64) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(!market.is_paused, HubError::MarketPaused);
        require!(token_in > 0, HubError::InvalidAmount);

        require_keys_eq!(
            ctx.accounts.base_mint.key(),
            market.base_mint,
            HubError::InvalidMint
        );
        require_keys_eq!(ctx.accounts.mint.key(), market.mint, HubError::InvalidMint);

        // 1) Curve math: compute GROSS base out (no fee applied yet)
        let v_b = market.v_base;
        let v_t = market.v_token;

        let k = v_b.checked_mul(v_t).ok_or(HubError::MathOverflow)?;

        let v_t_new = v_t
            .checked_add(token_in as u128)
            .ok_or(HubError::MathOverflow)?;

        let v_b_new = k.checked_div(v_t_new).ok_or(HubError::MathOverflow)?;

        let gross_base_out = v_b.checked_sub(v_b_new).ok_or(HubError::MathOverflow)?;
        require!(gross_base_out > 0, HubError::ZeroOut);

        // 2) Fee on SELL is in USDC (output)
        let fee_bps = market.fee_bps as u128;
        let protocol_share = market.protocol_fee_share_bps as u128;

        let total_fee = gross_base_out
            .checked_mul(fee_bps)
            .ok_or(HubError::MathOverflow)?
            .checked_div(10_000)
            .ok_or(HubError::MathOverflow)?;

        let admin_fee = total_fee
            .checked_mul(protocol_share)
            .ok_or(HubError::MathOverflow)?
            .checked_div(10_000)
            .ok_or(HubError::MathOverflow)?;

        let user_base_out = gross_base_out
            .checked_sub(total_fee)
            .ok_or(HubError::MathOverflow)?;

        // Slippage guard applies to what user actually receives
        require!(
            user_base_out >= min_base_out as u128,
            HubError::SlippageExceeded
        );

        // 3) Burn token_in from user (user signs)
        {
            let cpi_accounts = Burn {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.user_token_ata.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            };
            let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
            token::burn(cpi_ctx, token_in)?;
        }

        // 4) PDA signer seeds
        let market_key = market.key();
        let seeds: &[&[u8]] = &[
            b"treasury_authority",
            market_key.as_ref(),
            &[market.treasury_bump],
        ];
        let signer = &[seeds];

        // 5) Solvency: treasury must cover admin_fee + user payout
        let needed = admin_fee
            .checked_add(user_base_out)
            .ok_or(HubError::MathOverflow)?;

        require!(
            ctx.accounts.treasury_base_ata.amount as u128 >= needed,
            HubError::InsufficientTreasury
        );

        // 6) Transfer admin fee (USDC) from treasury -> adminFeeAta
        if admin_fee > 0 {
            let cpi_accounts = Transfer {
                from: ctx.accounts.treasury_base_ata.to_account_info(),
                to: ctx.accounts.admin_fee_ata.to_account_info(),
                authority: ctx.accounts.treasury_authority.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer,
            );
            token::transfer(cpi_ctx, admin_fee as u64)?;
        }

        // 7) Transfer user payout (USDC) from treasury -> userBaseAta
        {
            let cpi_accounts = Transfer {
                from: ctx.accounts.treasury_base_ata.to_account_info(),
                to: ctx.accounts.user_base_ata.to_account_info(),
                authority: ctx.accounts.treasury_authority.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer,
            );
            token::transfer(cpi_ctx, user_base_out as u64)?;
        }

        // 8) Update market state (virtual reserves) with the gross trade
        market.v_base = v_b_new;
        market.v_token = v_t_new;

        Ok(())
    }

    pub fn register_user(ctx: Context<RegisterUser>, kyc_hash: [u8; 32]) -> Result<()> {
        registry::handler_register_user(ctx, kyc_hash)
    }
}

#[derive(Accounts)]
pub struct InitMarket<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    pub mint: Account<'info, Mint>,
    pub base_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = admin,
        space = 8 + HubMarket::SPACE,
        seeds = [b"market", mint.key().as_ref()],
        bump
    )]
    pub market: Account<'info, HubMarket>,

    /// CHECK: PDA authority only
    #[account(
        seeds = [b"treasury_authority", market.key().as_ref()],
        bump
    )]
    pub treasury_authority: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = admin,
        associated_token::mint = base_mint,
        associated_token::authority = treasury_authority
    )]
    pub treasury_base_ata: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = admin,
        associated_token::mint = base_mint,
        associated_token::authority = admin
    )]
    pub admin_fee_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SwapBuy<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,
    pub base_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"market", mint.key().as_ref()],
        bump = market.bump
    )]
    pub market: Account<'info, HubMarket>,

    /// CHECK: PDA authority
    #[account(
        seeds = [b"treasury_authority", market.key().as_ref()],
        bump = market.treasury_bump
    )]
    pub treasury_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = user_base_ata.mint == base_mint.key(),
        constraint = user_base_ata.owner == user.key()
    )]
    pub user_base_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = treasury_base_ata.key() == market.treasury_base_ata,
        constraint = treasury_base_ata.mint == base_mint.key(),
        constraint = treasury_base_ata.owner == treasury_authority.key()
    )]
    pub treasury_base_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = admin_fee_ata.key() == market.admin_fee_ata,
        constraint = admin_fee_ata.mint == base_mint.key()
    )]
    pub admin_fee_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_token_ata.mint == mint.key(),
        constraint = user_token_ata.owner == user.key()
    )]
    pub user_token_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SwapSell<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,
    pub base_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"market", mint.key().as_ref()],
        bump = market.bump
    )]
    pub market: Account<'info, HubMarket>,

    /// CHECK: PDA authority
    #[account(
        seeds = [b"treasury_authority", market.key().as_ref()],
        bump = market.treasury_bump
    )]
    pub treasury_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = user_token_ata.mint == mint.key(),
        constraint = user_token_ata.owner == user.key()
    )]
    pub user_token_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_base_ata.mint == base_mint.key(),
        constraint = user_base_ata.owner == user.key()
    )]
    pub user_base_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = treasury_base_ata.key() == market.treasury_base_ata,
        constraint = treasury_base_ata.mint == base_mint.key(),
        constraint = treasury_base_ata.owner == treasury_authority.key()
    )]
    pub treasury_base_ata: Account<'info, TokenAccount>,

    // ✅ ADD THIS (needed by swap_sell fee routing)
    #[account(
        mut,
        constraint = admin_fee_ata.key() == market.admin_fee_ata,
        constraint = admin_fee_ata.mint == base_mint.key()
    )]
    pub admin_fee_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[account]
pub struct HubMarket {
    pub admin: Pubkey,
    pub mint: Pubkey,
    pub base_mint: Pubkey,

    pub treasury_base_ata: Pubkey,
    pub admin_fee_ata: Pubkey,

    pub v_base: u128,
    pub v_token: u128,

    pub fee_bps: u16,
    pub protocol_fee_share_bps: u16,

    pub is_paused: bool,

    pub bump: u8,
    pub treasury_bump: u8,
}

impl HubMarket {
    pub const SPACE: usize =
        32 + 32 + 32 + // admin, mint, base_mint
        32 + 32 +      // treasury_base_ata, admin_fee_ata
        16 + 16 +      // v_base, v_token
        2 + 2 +        // fee_bps, protocol_fee_share_bps
        1 +            // is_paused
        1 + 1;         // bump, treasury_bump
}

#[error_code]
pub enum HubError {
    #[msg("Invalid reserves")]
    InvalidReserves,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Slippage exceeded")]
    SlippageExceeded,
    #[msg("Zero output amount")]
    ZeroOut,
    #[msg("Market paused")]
    MarketPaused,
    #[msg("Invalid mint/accounts")]
    InvalidMint,
    #[msg("Invalid basis points value")]
    InvalidBps,
    #[msg("Treasury has insufficient funds")]
    InsufficientTreasury,
}
