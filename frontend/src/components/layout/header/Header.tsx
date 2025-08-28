import { Wallet } from '@gear-js/wallet-connect';

import styles from './Header.module.scss';
import { Logo } from './logo';

function Header() {
  return (
    <header className={styles.header}>
      <a href="#" className="-m-1.5 p-1.5 text-green-400 text-xl font-semibold">
        VaraNames
      </a>
      <Wallet theme="gear" />
    </header>
  );
}

export { Header };
