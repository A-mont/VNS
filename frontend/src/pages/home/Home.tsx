import React, { useState } from 'react';
import { Header } from '@/components';
import { ClaimVaraNameCard } from './ClaimVaraNameCard';
import { NameAvailabilityCard } from './AvailableNames';

function Home() {
  const [tab, setTab] = useState<'claim' | 'availability'>('claim');

  return (
    <>
      <div className="bg-black text-white font-header min-h-screen">
        <header className="inset-x-0 top-0 z-50 sticky backdrop-blur-md shadow">
          <Header />
        </header>
        <div className="relative isolate min-h-[80vh] flex flex-col items-center justify-start px-6 lg:px-8 pt-16 animate-fade-in">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
            <div
              style={{
                clipPath:
                  'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
              }}
              className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36rem] -translate-x-1/2 rotate-30 bg-gradient-to-tr from-[#04ce80] to-[#04ce80] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72rem]"
            />
          </div>

          {/* Hero */}
          <div className="w-full max-w-3xl text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold mb-4">
              Claim your unique <span className="text-green-400 font-bold">.vara</span> name
            </h1>
            <p className="mt-1 text-sm sm:text-lg text-white/80">Human-Readable Identities for the Vara Network.</p>

            {/* Tabs */}
            <div className="mt-8 flex justify-center">
              <div
                role="tablist"
                aria-label="VaraNames actions"
                className="inline-flex p-1 rounded-2xl bg-white/10 border border-white/15 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                <button
                  role="tab"
                  aria-selected={tab === 'claim'}
                  onClick={() => setTab('claim')}
                  className={[
                    'px-5 py-2.5 rounded-xl font-semibold transition',
                    tab === 'claim' ? 'bg-white text-gray-900 shadow' : 'text-white/80 hover:text-white',
                  ].join(' ')}>
                  Claim
                </button>
                <button
                  role="tab"
                  aria-selected={tab === 'availability'}
                  onClick={() => setTab('availability')}
                  className={[
                    'px-5 py-2.5 rounded-xl font-semibold transition',
                    tab === 'availability' ? 'bg-white text-gray-900 shadow' : 'text-white/80 hover:text-white',
                  ].join(' ')}>
                  Availability
                </button>
              </div>
            </div>
          </div>

          {/* Panel content */}
          <div className="w-full max-w-3xl mt-8">
            {tab === 'claim' ? (
              <div role="tabpanel" aria-labelledby="tab-claim">
                <ClaimVaraNameCard />
              </div>
            ) : (
              <div role="tabpanel" aria-labelledby="tab-availability">
                <NameAvailabilityCard />
              </div>
            )}
          </div>
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]">
            <div
              style={{
                clipPath:
                  'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
              }}
              className="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36rem] -translate-x-1/2 bg-gradient-to-tr from-[#04ce80] to-[#04ce80] opacity-30 sm:left-[calc(50%+36rem)] sm:w-[72rem]"
            />
          </div>
        </div>
      </div>
    </>
  );
}

export { Home };
