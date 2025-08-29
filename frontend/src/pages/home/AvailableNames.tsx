'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useAccount, useAlert, useApi } from '@gear-js/react-hooks';
import { Program, Service } from '@/hocs/lib';

const PROGRAM_ID = '0xa28014929e22e705c5bf53f9651d514b87abf9b274763d731b3d9bae54ab3d6b';
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000; // para estimar precio

const te = new TextEncoder();
const nameToBytes = (s: string) => te.encode(s);

type Status = 'idle' | 'checking' | 'available' | 'taken' | 'reserved_or_invalid' | 'error';

export function NameAvailabilityCard() {
  const { api, isApiReady } = useApi();
  const { account } = useAccount();
  const alert = useAlert();

  const [name, setName] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [pricePlancks, setPricePlancks] = useState<bigint | null>(null);
  const [checking, setChecking] = useState(false);

  const svc = useMemo(() => (isApiReady ? new Service(new Program(api, PROGRAM_ID)) : null), [api, isApiReady]);

  useEffect(() => {
    if (!svc) return;
    if (!name.trim()) {
      setStatus('idle');
      setExpiresAt(null);
      setPricePlancks(null);
      return;
    }
    if (name.length > 256) {
      setStatus('reserved_or_invalid');
      setExpiresAt(null);
      setPricePlancks(null);
      return;
    }

    let cancel = false;
    setChecking(true);
    setStatus('checking');

    const run = async () => {
      try {
        const bytes = Array.from(nameToBytes(name.trim()));
        // 1) available?
        const isAvail = await svc.available(bytes, account?.address);
        if (cancel) return;

        // 2) siempre calculamos precio estimado para 1 año
        const price = await svc.price(bytes, ONE_YEAR_MS, account?.address);
        if (!cancel) setPricePlancks(typeof price === 'bigint' ? price : BigInt(price as any));

        if (isAvail) {
          if (!cancel) {
            setStatus('available');
            setExpiresAt(null);
          }
          return;
        }

        // 3) si no está disponible, intenta leer expiry
        const expiry = await svc.expiryOf(bytes, account?.address);
        if (cancel) return;

        if (expiry == null) {
          // puede ser reservado o nombre inválido (o nunca registrado)
          setStatus('reserved_or_invalid');
          setExpiresAt(null);
        } else {
          // expiry es u64 (ms) según tu contrato
          const ms = typeof expiry === 'bigint' ? Number(expiry) : Number(expiry);
          setStatus('taken');
          setExpiresAt(ms);
        }
      } catch (e) {
        if (!cancel) {
          setStatus('error');
          setExpiresAt(null);
          setPricePlancks(null);
          alert.error((e as any)?.message ?? 'Availability check failed');
        }
      } finally {
        if (!cancel) setChecking(false);
      }
    };

    // debounce 350ms
    const t = setTimeout(run, 350);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [svc, name, account?.address, alert]);

  const formatVara = (p?: bigint | null) => {
    if (!p) return '—';
    // si usas 12 decimales (Vara), muestra en VARA; ajusta si usas otra precisión
    const DECIMALS = 12n;
    const int = p / 10n ** DECIMALS;
    const frac = (p % 10n ** DECIMALS).toString().padStart(Number(DECIMALS), '0').slice(0, 4); // 4 decimales visibles
    return `${int}.${frac} VARA`;
  };

  return (
    <div>
      <div className="mt-8 text-left bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,0.15)]">
        <label className="block text-sm sm:text-base text-white/80 font-medium">Check availability</label>
        <div className="mt-2 flex items-center gap-3">
          <input
            type="text"
            placeholder="e.g. alice"
            value={name}
            onChange={(e) => setName(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            className="flex-1 rounded-lg border border-white/15 bg-white/10 text-white placeholder-white/40 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-400/60 focus:border-transparent"
          />
          <div
            className={[
              'px-3 py-2 rounded-lg text-sm font-semibold min-w-[8rem] text-center',
              status === 'available' && 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/30',
              status === 'taken' && 'bg-yellow-400/15 text-yellow-300 border border-yellow-400/30',
              status === 'reserved_or_invalid' && 'bg-red-400/15 text-red-300 border border-red-400/30',
              status === 'checking' && 'bg-white/10 text-white/70 border border-white/15',
              status === 'error' && 'bg-red-500/20 text-red-200 border border-red-400/40',
              status === 'idle' && 'bg-white/10 text-white/70 border border-white/15',
            ]
              .filter(Boolean)
              .join(' ')}>
            {checking ? (
              <span className="inline-flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden>
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    className="opacity-30"
                  />
                  <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" fill="none" />
                </svg>
                Checking…
              </span>
            ) : status === 'available' ? (
              'Available'
            ) : status === 'taken' ? (
              'Taken'
            ) : status === 'reserved_or_invalid' ? (
              'Unavailable'
            ) : status === 'error' ? (
              'Error'
            ) : (
              '—'
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="text-white/60">Estimated 1-year price</div>
            <div className="mt-1 font-mono text-white/90">{formatVara(pricePlancks)}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="text-white/60">Expires (if taken)</div>
            <div className="mt-1 font-mono text-white/90">{expiresAt ? new Date(expiresAt).toLocaleString() : '—'}</div>
          </div>
        </div>

        <p className="mt-3 text-xs sm:text-sm text-white/60">
          Availability is computed on-chain via <code>available(name)</code>. If taken, we show the current expiry from{' '}
          <code>expiry_of(name)</code>.
        </p>
      </div>
    </div>
  );
}
