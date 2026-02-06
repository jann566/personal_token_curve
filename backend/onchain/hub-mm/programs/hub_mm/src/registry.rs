use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};

#[account]
pub struct RegistryEntry {
    pub admin: Pubkey,
    pub owner_wallet: Pubkey,
    pub mint: Pubkey,
    pub created_slot: u64,
    pub bump: u8,
    pub kyc_hash: [u8; 32], // optional: set [0;32] if unused
}

impl RegistryEntry {
    pub const SPACE: usize =
        32 + // admin
        32 + // owner_wallet
        32 + // mint
        8  + // created_slot
        1  + // bump
        32;  // kyc_hash
}

#[derive(Accounts)]
pub struct RegisterUser<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: We only need the pubkey for PDA seeds. No data is read.
    pub owner_wallet: UncheckedAccount<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = admin,
        space = 8 + RegistryEntry::SPACE,
        seeds = [b"registry", owner_wallet.key().as_ref()],
        bump
    )]
    pub registry: Account<'info, RegistryEntry>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler_register_user(
    ctx: Context<RegisterUser>,
    kyc_hash: [u8; 32],
) -> Result<()> {
    let registry = &mut ctx.accounts.registry;

    registry.admin = ctx.accounts.admin.key();
    registry.owner_wallet = ctx.accounts.owner_wallet.key();
    registry.mint = ctx.accounts.mint.key();
    registry.created_slot = Clock::get()?.slot;
    registry.bump = ctx.bumps.registry;
    registry.kyc_hash = kyc_hash;

    Ok(())
}
