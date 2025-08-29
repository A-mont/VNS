import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, useAlert, useApi } from '@gear-js/react-hooks';
import { web3Enable, web3FromSource } from '@polkadot/extension-dapp';
import { decodeAddress } from '@polkadot/util-crypto';
import { TransactionBuilder } from 'sails-js';
import { Program, Service } from '@/hocs/lib';
import { blake2b } from '@noble/hashes/blake2b';

const PROGRAM_ID = '0xa28014929e22e705c5bf53f9651d514b87abf9b274763d731b3d9bae54ab3d6b';

const MIN_COMMIT_AGE_MS = 60_000;
const DEFAULT_DURATION_MS = 365n * 24n * 60n * 60n * 1000n;

const te = new TextEncoder();
const u8aToHex = (u8: Uint8Array) =>
  '0x' +
  Array.from(u8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
const nameToBytes = (name: string) => te.encode(name);

/** commitment = blake2b-256(name || owner || secret || salt) */
function makeCommitment(name: string, ownerBytes32: Uint8Array, secret32: Uint8Array, salt32: Uint8Array): Uint8Array {
  const n = nameToBytes(name);
  const preimage = new Uint8Array(n.length + 32 + 32 + 32);
  let off = 0;
  preimage.set(n, off);
  off += n.length;
  preimage.set(ownerBytes32, off);
  off += 32;
  preimage.set(secret32, off);
  off += 32;
  preimage.set(salt32, off);
  return blake2b(preimage, { dkLen: 32 });
}

export function ClaimVaraNameCard() {
  const { account } = useAccount();
  const { api, isApiReady } = useApi();
  const alert = useAlert();

  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void web3Enable('VNS Registrar');
  }, []);

  const ownerBytes32 = useMemo(() => {
    if (!account?.address) return null;
    try {
      return decodeAddress(account.address);
    } catch {
      return null;
    }
  }, [account?.address]);

  const handleClaim = useCallback(async () => {
    if (!account) return alert.error('Connect your wallet first');
    if (!isApiReady) return alert.error('Node API not ready');
    if (!name || name.trim().length === 0) return alert.error('Enter a name');

    if (!ownerBytes32 || ownerBytes32.length !== 32) {
      return alert.error('Invalid owner address');
    }

    const secret = crypto.getRandomValues(new Uint8Array(32));
    const salt = crypto.getRandomValues(new Uint8Array(32));

    const commitment = makeCommitment(name.trim(), ownerBytes32, secret, salt);

    try {
      setSending(true);
      setStatus('Submitting commitment…');

      const svc = new Service(new Program(api, PROGRAM_ID));
      const injector = await web3FromSource(account.meta.source);

      // 1) commit
      const commitTx: TransactionBuilder<unknown> = svc.commit(commitment);
      commitTx.withAccount(account.decodedAddress, { signer: injector.signer });
      await commitTx.calculateGas();
      const { blockHash: commitBlock, response: commitResp } = await commitTx.signAndSend();
      alert.info(`Commit in block ${commitBlock}`);
      await commitResp();

      // 2) wait min_commit_age
      setStatus(`Waiting ${Math.ceil(MIN_COMMIT_AGE_MS / 1000)}s before register…`);
      await new Promise((res) => setTimeout(res, MIN_COMMIT_AGE_MS));

      // 3) register 
      setStatus('Finalizing registration…');
      const ownerHex32 = u8aToHex(ownerBytes32);
      const nameBytes = Array.from(nameToBytes(name.trim()));
      const registerTx = svc.register(nameBytes, ownerHex32, DEFAULT_DURATION_MS, secret, salt, null);
      registerTx.withAccount(account.decodedAddress, { signer: injector.signer });
      await registerTx.calculateGas();
      const { blockHash: regBlock, response: regResp } = await registerTx.signAndSend();
      alert.info(`Register in block ${regBlock}`);
      await regResp();

      setStatus(`✅ Registered “${name}.vara” successfully`);
      alert.success(`Registered "${name}.vara"`);
    } catch (e) {
      const msg = (e as any)?.message ?? 'Transaction failed';
      setStatus(`❌ ${msg}`);
      alert.error(String(msg));
    } finally {
      setSending(false);
    }
  }, [account, isApiReady, name, ownerBytes32, api, alert]);

  return (
    <div className="mt-8">
      <section>
        <div className="mt-8 text-left bg-white/5  border border-white/10 rounded-xl p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,0.15)]">
          <label className="block text-sm sm:text-base text-white/80 font-medium">Choose a name</label>
          <div className="mt-2 flex items-center gap-3">
            <input
              type="text"
              placeholder="e.g. alice"
              value={name}
              onChange={(e) => setName(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              className="flex-1 rounded-lg border border-white/15 bg-white/10 text-white placeholder-white/40 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-400/60 focus:border-transparent"
              disabled={sending}
            />
            <button
              onClick={handleClaim}
              disabled={sending || !name}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 font-semibold
                       bg-gradient-to-r from-green-400 to-emerald-500 text-white-900
                       hover:opacity-95 active:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
              {sending ? (
                <>
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" aria-hidden>
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
                  Claiming…
                </>
              ) : (
                <>Claim</>
              )}
            </button>
          </div>

          {status && (
            <div className="mt-4 rounded-lg border border-white/15 bg-white/10 p-3 text-white/90 text-sm">{status}</div>
          )}
        </div>
      </section>
    </div>
  );
}
