import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Button from '../components/Button';
import Input from '../components/Input';
import Card from '../components/Card';
import { authApi, handleAuthError } from '../api/auth';

type Step = 1 | 2 | 3;

const STORAGE_KEY_USER_ID = 'registerUserId';
const STORAGE_KEY_STEP = 'registerStep';

export function RegisterPage() {
  const [step, setStep] = useState<Step>(1);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Restore state from localStorage on mount
  useEffect(() => {
    const savedUserId = localStorage.getItem(STORAGE_KEY_USER_ID);
    const savedStep = localStorage.getItem(STORAGE_KEY_STEP);
    
    if (savedUserId) {
      setUserId(savedUserId);
      console.log('[Register] Restored userId from localStorage:', savedUserId);
    }
    
    if (savedStep) {
      const step = parseInt(savedStep, 10) as Step;
      setStep(step);
      console.log('[Register] Restored step from localStorage:', step);
    }
  }, []);

  // Step 1
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Step 2
  const [pdf, setPdf] = useState<File | null>(null);

  // Step 3
  const [phantomWallet, setPhantomWallet] = useState('');

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // ✅ API Contract - Step 1
      const response = await authApi.registerStep1({
        email,
        password,
      });

      console.log('[Register Step1] Success, userId:', response.userId);
      setUserId(response.userId);
      
      // Persist to localStorage
      localStorage.setItem(STORAGE_KEY_USER_ID, response.userId);
      localStorage.setItem(STORAGE_KEY_STEP, '2');
      
      setSuccess('✅ Schritt 1 abgeschlossen!');
      setStep(2);
      setEmail('');
      setPassword('');
    } catch (err) {
      const errorInfo = handleAuthError(err);
      setError(`❌ ${errorInfo.message}`);
      console.error('Step 1 Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!pdf) {
      setError('❌ Bitte wähle eine PDF-Datei aus');
      return;
    }

    // Ensure userId is available
    if (!userId) {
      const savedUserId = localStorage.getItem(STORAGE_KEY_USER_ID);
      if (!savedUserId) {
        setError('❌ Session lost. Please start over.');
        return;
      }
      setUserId(savedUserId);
    }

    setLoading(true);
    try {
      // ✅ API Contract - Step 2
      const effectiveUserId = userId || localStorage.getItem(STORAGE_KEY_USER_ID);
      if (!effectiveUserId) throw new Error('userId not available');

      console.log('[Register Step2] Submitting with userId:', effectiveUserId);
      await authApi.registerStep2(effectiveUserId, pdf);
      
      localStorage.setItem(STORAGE_KEY_STEP, '3');
      setSuccess('✅ Schritt 2 abgeschlossen!');
      setStep(3);
      setPdf(null);
    } catch (err) {
      const errorInfo = handleAuthError(err);
      setError(`❌ ${errorInfo.message}`);
      console.error('Step 2 Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!phantomWallet) {
      setError('❌ Phantom Wallet-Adresse erforderlich');
      return;
    }

    // Ensure userId is available
    if (!userId) {
      const savedUserId = localStorage.getItem(STORAGE_KEY_USER_ID);
      if (!savedUserId) {
        setError('❌ Session lost. Please start over.');
        return;
      }
      setUserId(savedUserId);
    }

    setLoading(true);
    try {
      // ✅ API Contract - Step 3
      const effectiveUserId = userId || localStorage.getItem(STORAGE_KEY_USER_ID);
      if (!effectiveUserId) throw new Error('userId not available');

      console.log('[Register Step3] Submitting payload:', {
        userId: effectiveUserId,
        phantomWallet,
      });

      await authApi.registerStep3({
        userId: effectiveUserId,
        phantomWallet,
      });

      console.log('[Register Step3] Success!');
      localStorage.removeItem(STORAGE_KEY_USER_ID);
      localStorage.removeItem(STORAGE_KEY_STEP);
      
      setSuccess('✅ Registrierung abgeschlossen! 🎉');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);
    } catch (err) {
      const errorInfo = handleAuthError(err);
      setError(`❌ ${errorInfo.message}`);
      console.error('Step 3 Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`flex-1 h-2 mx-1 rounded ${
                  s <= step ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              />
            ))}
          </div>
          <p className="text-center text-slate-600">
            Schritt {step} von 3
          </p>
        </div>

        <Card title="Registrierung">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
              {success}
            </div>
          )}

          {/* Step 1: Email & Passwort */}
          {step === 1 && (
            <form onSubmit={handleStep1Submit} className="space-y-4">
              <Input
                label="E-Mail Adresse"
                type="email"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                placeholder="deine@email.de"
                required
              />
              <Input
                label="Passwort (Min. 8 Zeichen)"
                type="password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <p className="text-xs text-slate-500">
                Dein Passwort wird mit bcrypt verschlüsselt gespeichert.
              </p>
              <Button type="submit" loading={loading} size="lg" className="w-full">
                Weiter zu Schritt 2
              </Button>
            </form>
          )}

          {/* Step 2: PDF Upload */}
          {step === 2 && (
            <form onSubmit={handleStep2Submit} className="space-y-4">
              <p className="text-slate-600 mb-4">
                Bitte lade ein Verifizierungsdokument (PDF) hoch.
              </p>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPdf(e.target.files?.[0] || null)}
                  className="hidden"
                  id="pdf-input"
                  required
                />
                <label htmlFor="pdf-input" className="cursor-pointer block">
                  <p className="text-slate-700 font-medium">
                    {pdf ? pdf.name : '📄 PDF hier hochladen'}
                  </p>
                  <p className="text-slate-500 text-sm">
                    oder klicke um eine Datei zu wählen
                  </p>
                </label>
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="flex-1"
                  onClick={() => {
                    setStep(1);
                    setSuccess('');
                  }}
                >
                  ← Zurück
                </Button>
                <Button type="submit" loading={loading} size="lg" className="flex-1">
                  Weiter zu Schritt 3 →
                </Button>
              </div>
            </form>
          )}

          {/* Step 3: Phantom Wallet */}
          {step === 3 && (
            <form onSubmit={handleStep3Submit} className="space-y-4">
              <Input
                label="Phantom Wallet Adresse"
                type="text"
                value={phantomWallet}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhantomWallet(e.target.value)}
                placeholder="Deine Solana Wallet Adresse (Base58)"
                required
              />
              <p className="text-xs text-slate-500">
                Dies ist deine öffentliche Solana-Wallet-Adresse, z.B. aus Phantom.
              </p>

              <div className="bg-slate-50 p-6 rounded-lg max-h-64 overflow-y-auto mb-4">
                <h3 className="font-semibold mb-3">Nutzungsbedingungen</h3>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">
                  {`Durch die Registrierung akzeptierst du folgende Bedingungen:

1. Du bist volljährig und berechtigt, ein Konto zu erstellen
2. Alle Informationen sind korrekt
3. Du wirst die Plattform nicht missbräuchlich nutzen
4. Du hältst dich an alle geltenden Gesetze
5. Du verstehst die Risiken von Kryptowährungstransaktionen

Diese Plattform wird "as-is" bereitgestellt.`}
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="flex-1"
                  onClick={() => {
                    setStep(2);
                    setSuccess('');
                  }}
                >
                  ← Zurück
                </Button>
                <Button
                  type="submit"
                  loading={loading}
                  size="lg"
                  className="flex-1"
                >
                  Registrierung Abschließen ✓
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </Layout>
  );
}

export default RegisterPage;
