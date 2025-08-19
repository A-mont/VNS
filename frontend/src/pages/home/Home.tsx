import { SearchBar } from './SearchBar';
import { RegisteredNames } from './RegisteredNames';
import { Wallet } from '@gear-js/wallet-connect';
import { Header } from '@/components';

function Home() {
  return (
     <>
     <Header/>
      <div className="bg-black text-white font-header">
        {/* Header Section */}
        <header className="inset-x-0 top-0 z-50 sticky backdrop-blur-md shadow">
          <nav className="flex items-center justify-between p-6 lg:px-8">
            <div className="flex lg:flex-1">
              <a href="#" className="-m-1.5 p-1.5 text-green-400 text-0xl font-semibold ">
                VaraNames
              </a>
            </div>
          </nav>
        </header>

        {/* Hero + Input Section */}
        <div className="relative isolate min-h-[80vh] flex flex-col items-center justify-center px-6 lg:px-8 animate-fade-in">
          {/* Blurred background shapes */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
            <div
              style={{
                clipPath:
                  'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
              }}
              className="relative left-[calc(50%-11rem)] aspect-1155/678 w-[36rem] -translate-x-1/2 rotate-30 bg-gradient-to-tr from-[#04ce80] to-[#04ce80] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72rem]"
            />
          </div>

          <div className="w-full pt-19 lg:pt-22 max-w-xl text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold mb-6 font-header ">
              Claim your unique <span className="text-green-400 font-bold">.vara</span> name
            </h1>
            <p className="mt-2 text-sm  sm:text-lg  text-white/80 ">Human-Readable Identities for the Vara Network.</p>
            <SearchBar />
          </div>

          <RegisteredNames />
          {/* Bottom blur */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]">
            <div
              style={{
                clipPath:
                  'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
              }}
              className="relative left-[calc(50%+3rem)] aspect-1155/678 w-[36rem] -translate-x-1/2 bg-gradient-to-tr from-[#04ce80] to-[#04ce80] opacity-30 sm:left-[calc(50%+36rem)] sm:w-[72rem]"
            />
          </div>
        </div>
      </div>
    </>
  );
}

export { Home };
