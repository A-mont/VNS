
import { GearApi, decodeAddress } from '@gear-js/api';
import { TypeRegistry } from '@polkadot/types';
import { TransactionBuilder, getServiceNamePrefix, getFnNamePrefix, ZERO_ADDRESS } from 'sails-js';

export type ActorId = string;

export interface InitRegistrar {
  registry: ActorId;
  tld_node: bigint | string;
  controller: ActorId;
  base_price: bigint | string;
  premium_price: bigint | string;
  min_commit_age: bigint | string;
  max_commit_age: bigint | string;
  grace_period: bigint | string;
}

export type RegistrarEvent =
  | { CommitSubmitted: { commitment: [string, number[]]; timestamp: bigint | string } }
  | { NameRegistered: { name: number[]; owner: ActorId; expires: bigint | string; cost: bigint | string } }
  | { NameRenewed: { name: number[]; expires: bigint | string; cost: bigint | string } }
  | { PricesSet: { base: bigint | string; premium: bigint | string } }
  | { CommitAgesSet: { min: bigint | string; max: bigint | string } }
  | { GracePeriodSet: { grace: bigint | string } }
  | { NamesReserved: { labels: number[][] } }
  | { Withdrawn: { to: ActorId; amount: bigint | string } };

const types = {
  InitRegistrar: {
    registry: '[u8;32]',
    tld_node: 'U256',
    controller: '[u8;32]',
    base_price: 'u128',
    premium_price: 'u128',
    min_commit_age: 'u64',
    max_commit_age: 'u64',
    grace_period: 'u64',
  },
  CommitSubmitted: {
    commitment: '[u8;32]',
    timestamp: 'u64',
  },
  NameRegistered: {
    name: 'Vec<u8>',
    owner: '[u8;32]',
    expires: 'u64',
    cost: 'u128',
  },
  NameRenewed: {
    name: 'Vec<u8>',
    expires: 'u64',
    cost: 'u128',
  },
  PricesSet: {
    base: 'u128',
    premium: 'u128',
  },
  CommitAgesSet: {
    min: 'u64',
    max: 'u64',
  },
  GracePeriodSet: {
    grace: 'u64',
  },
  NamesReserved: {
    labels: 'Vec<Vec<u8>>',
  },
  Withdrawn: {
    to: '[u8;32]',
    amount: 'u128',
  },
  RegistrarEvent: {
    _enum: {
      CommitSubmitted: 'CommitSubmitted',
      NameRegistered: 'NameRegistered',
      NameRenewed: 'NameRenewed',
      PricesSet: 'PricesSet',
      CommitAgesSet: 'CommitAgesSet',
      GracePeriodSet: 'GracePeriodSet',
      NamesReserved: 'NamesReserved',
      Withdrawn: 'Withdrawn',
    },
  },
};

export class Program {
  public readonly registry: TypeRegistry;
  public readonly service: Service;

  constructor(
    public api: GearApi,
    private _programId?: `0x${string}`,
  ) {
    this.registry = new TypeRegistry();
    this.registry.setKnownTypes({ types });
    this.registry.register(types);

    this.service = new Service(this);
  }

  public get programId(): `0x${string}` {
    if (!this._programId) throw new Error('Program ID is not set');
    return this._programId;
  }

  newCtorFromCode(
    code: Uint8Array | Buffer,
    init: InitRegistrar,
  ): TransactionBuilder<null> {
    const builder = new TransactionBuilder<null>(
      this.api,
      this.registry,
      'upload_program',
      ['New', init],
      '(String, InitRegistrar)',
      'String',
      code,
    );
    this._programId = builder.programId;
    return builder;
  }

  newCtorFromCodeId(
    codeId: `0x${string}`,
    init: InitRegistrar,
  ): TransactionBuilder<null> {
    const builder = new TransactionBuilder<null>(
      this.api,
      this.registry,
      'create_program',
      ['New', init],
      '(String, InitRegistrar)',
      'String',
      codeId,
    );
    this._programId = builder.programId;
    return builder;
  }
}

export class Service {
  constructor(private _program: Program) {}

  public commit(commitment: [number, number[]]): TransactionBuilder<RegistrarEvent> {
    if (!this._program.programId) throw new Error('Program ID is not set');
    return new TransactionBuilder<RegistrarEvent>(
      this._program.api,
      this._program.registry,
      'send_message',
      ['Service', 'Commit', commitment],
      '(String, String, [u8;32])',
      'RegistrarEvent',
      this._program.programId,
    );
  }

  public register(
    name: number[],
    owner: ActorId,
    duration: bigint | string | number,
    secret: [number, number[]],
    salt: [number, number[]],
    resolver: ActorId | null,
  ): TransactionBuilder<RegistrarEvent> {
    if (!this._program.programId) throw new Error('Program ID is not set');
    return new TransactionBuilder<RegistrarEvent>(
      this._program.api,
      this._program.registry,
      'send_message',
      ['Service', 'Register', name, owner, duration, secret, salt, resolver],
      '(String, String, Vec<u8>, [u8;32], u64, [u8;32], [u8;32], Option<[u8;32]>)',
      'RegistrarEvent',
      this._program.programId,
    );
  }

  public renew(
    name: number[],
    duration: bigint | string | number,
  ): TransactionBuilder<RegistrarEvent> {
    if (!this._program.programId) throw new Error('Program ID is not set');
    return new TransactionBuilder<RegistrarEvent>(
      this._program.api,
      this._program.registry,
      'send_message',
      ['Service', 'Renew', name, duration],
      '(String, String, Vec<u8>, u64)',
      'RegistrarEvent',
      this._program.programId,
    );
  }

  public reserveNames(labels: number[][]): TransactionBuilder<RegistrarEvent> {
    if (!this._program.programId) throw new Error('Program ID is not set');
    return new TransactionBuilder<RegistrarEvent>(
      this._program.api,
      this._program.registry,
      'send_message',
      ['Service', 'ReserveNames', labels],
      '(String, String, Vec<Vec<u8>>)',
      'RegistrarEvent',
      this._program.programId,
    );
  }

  public setCommitAges(
    min: bigint | string | number,
    max: bigint | string | number,
  ): TransactionBuilder<RegistrarEvent> {
    if (!this._program.programId) throw new Error('Program ID is not set');
    return new TransactionBuilder<RegistrarEvent>(
      this._program.api,
      this._program.registry,
      'send_message',
      ['Service', 'SetCommitAges', min, max],
      '(String, String, u64, u64)',
      'RegistrarEvent',
      this._program.programId,
    );
  }

  public setGracePeriod(
    grace: bigint | string | number,
  ): TransactionBuilder<RegistrarEvent> {
    if (!this._program.programId) throw new Error('Program ID is not set');
    return new TransactionBuilder<RegistrarEvent>(
      this._program.api,
      this._program.registry,
      'send_message',
      ['Service', 'SetGracePeriod', grace],
      '(String, String, u64)',
      'RegistrarEvent',
      this._program.programId,
    );
  }

  public setPrices(
    base: bigint | string | number,
    premium: bigint | string | number,
  ): TransactionBuilder<RegistrarEvent> {
    if (!this._program.programId) throw new Error('Program ID is not set');
    return new TransactionBuilder<RegistrarEvent>(
      this._program.api,
      this._program.registry,
      'send_message',
      ['Service', 'SetPrices', base, premium],
      '(String, String, u128, u128)',
      'RegistrarEvent',
      this._program.programId,
    );
  }

  public withdraw(
    to: ActorId,
    amount: bigint | string | number,
  ): TransactionBuilder<RegistrarEvent> {
    if (!this._program.programId) throw new Error('Program ID is not set');
    return new TransactionBuilder<RegistrarEvent>(
      this._program.api,
      this._program.registry,
      'send_message',
      ['Service', 'Withdraw', to, amount],
      '(String, String, [u8;32], u128)',
      'RegistrarEvent',
      this._program.programId,
    );
  }

  public async available(
    name: number[],
    originAddress?: string,
    value?: number | string | bigint,
    atBlock?: `0x${string}`,
  ): Promise<boolean> {
    const payload = this._program.registry.createType('(String, String, Vec<u8>)', ['Service', 'Available', name]).toHex();
    const reply = await this._program.api.message.calculateReply({
      destination: this._program.programId,
      origin: originAddress ? decodeAddress(originAddress) : ZERO_ADDRESS,
      payload,
      value: value ?? 0,
      gasLimit: this._program.api.blockGasLimit.toBigInt(),
      at: atBlock,
    });
    if (!reply.code.isSuccess) throw new Error(this._program.registry.createType('String', reply.payload).toString());
    const result = this._program.registry.createType('(String, String, bool)', reply.payload);
    return result[2].valueOf() as boolean;
  }

  public async expiryOf(
    name: number[],
    originAddress?: string,
    value?: number | string | bigint,
    atBlock?: `0x${string}`,
  ): Promise<bigint | string | null> {
    const payload = this._program.registry.createType('(String, String, Vec<u8>)', ['Service', 'ExpiryOf', name]).toHex();
    const reply = await this._program.api.message.calculateReply({
      destination: this._program.programId,
      origin: originAddress ? decodeAddress(originAddress) : ZERO_ADDRESS,
      payload,
      value: value ?? 0,
      gasLimit: this._program.api.blockGasLimit.toBigInt(),
      at: atBlock,
    });
    if (!reply.code.isSuccess) throw new Error(this._program.registry.createType('String', reply.payload).toString());
    const result = this._program.registry.createType('(String, String, Option<u64>)', reply.payload);
    return result[2].toJSON() as bigint | string | null;
  }

  public async price(
    name: number[],
    duration: bigint | string | number,
    originAddress?: string,
    value?: number | string | bigint,
    atBlock?: `0x${string}`,
  ): Promise<bigint | string> {
    const payload = this._program.registry.createType('(String, String, Vec<u8>, u64)', ['Service', 'Price', name, duration]).toHex();
    const reply = await this._program.api.message.calculateReply({
      destination: this._program.programId,
      origin: originAddress ? decodeAddress(originAddress) : ZERO_ADDRESS,
      payload,
      value: value ?? 0,
      gasLimit: this._program.api.blockGasLimit.toBigInt(),
      at: atBlock,
    });
    if (!reply.code.isSuccess) throw new Error(this._program.registry.createType('String', reply.payload).toString());
    const result = this._program.registry.createType('(String, String, u128)', reply.payload);
    return result[2].toBigInt();
  }

  public subscribeToCommitSubmittedEvent(
    callback: (data: { commitment: [string, number[]]; timestamp: bigint | string }) => void | Promise<void>
  ): Promise<() => void> {
    return this._program.api.gearEvents.subscribeToGearEvent('UserMessageSent', ({ data: { message } }) => {
      if (!message.source.eq(this._program.programId) || !message.destination.eq(ZERO_ADDRESS)) return;
      const payload = message.payload.toHex();
      if (getServiceNamePrefix(payload) === 'Service' && getFnNamePrefix(payload) === 'CommitSubmitted') {
        void Promise.resolve(callback(
          this._program.registry.createType('(String, String, CommitSubmitted)', message.payload)[2].toJSON() as {
            commitment: [string, number[]];
            timestamp: bigint | string;
          }
        )).catch(console.error);
      }
    });
  }

  public subscribeToNameRegisteredEvent(
    callback: (data: { name: number[]; owner: ActorId; expires: bigint | string; cost: bigint | string }) => void | Promise<void>
  ): Promise<() => void> {
    return this._program.api.gearEvents.subscribeToGearEvent('UserMessageSent', ({ data: { message } }) => {
      if (!message.source.eq(this._program.programId) || !message.destination.eq(ZERO_ADDRESS)) return;
      const payload = message.payload.toHex();
      if (getServiceNamePrefix(payload) === 'Service' && getFnNamePrefix(payload) === 'NameRegistered') {
        void Promise.resolve(callback(
          this._program.registry.createType('(String, String, NameRegistered)', message.payload)[2].toJSON() as {
            name: number[];
            owner: ActorId;
            expires: bigint | string;
            cost: bigint | string;
          }
        )).catch(console.error);
      }
    });
  }

  public subscribeToNameRenewedEvent(
    callback: (data: { name: number[]; expires: bigint | string; cost: bigint | string }) => void | Promise<void>
  ): Promise<() => void> {
    return this._program.api.gearEvents.subscribeToGearEvent('UserMessageSent', ({ data: { message } }) => {
      if (!message.source.eq(this._program.programId) || !message.destination.eq(ZERO_ADDRESS)) return;
      const payload = message.payload.toHex();
      if (getServiceNamePrefix(payload) === 'Service' && getFnNamePrefix(payload) === 'NameRenewed') {
        void Promise.resolve(callback(
          this._program.registry.createType('(String, String, NameRenewed)', message.payload)[2].toJSON() as {
            name: number[];
            expires: bigint | string;
            cost: bigint | string;
          }
        )).catch(console.error);
      }
    });
  }

  public subscribeToPricesSetEvent(
    callback: (data: { base: bigint | string; premium: bigint | string }) => void | Promise<void>
  ): Promise<() => void> {
    return this._program.api.gearEvents.subscribeToGearEvent('UserMessageSent', ({ data: { message } }) => {
      if (!message.source.eq(this._program.programId) || !message.destination.eq(ZERO_ADDRESS)) return;
      const payload = message.payload.toHex();
      if (getServiceNamePrefix(payload) === 'Service' && getFnNamePrefix(payload) === 'PricesSet') {
        void Promise.resolve(callback(
          this._program.registry.createType('(String, String, PricesSet)', message.payload)[2].toJSON() as {
            base: bigint | string;
            premium: bigint | string;
          }
        )).catch(console.error);
      }
    });
  }

  public subscribeToCommitAgesSetEvent(
    callback: (data: { min: bigint | string; max: bigint | string }) => void | Promise<void>
  ): Promise<() => void> {
    return this._program.api.gearEvents.subscribeToGearEvent('UserMessageSent', ({ data: { message } }) => {
      if (!message.source.eq(this._program.programId) || !message.destination.eq(ZERO_ADDRESS)) return;
      const payload = message.payload.toHex();
      if (getServiceNamePrefix(payload) === 'Service' && getFnNamePrefix(payload) === 'CommitAgesSet') {
        void Promise.resolve(callback(
          this._program.registry.createType('(String, String, CommitAgesSet)', message.payload)[2].toJSON() as {
            min: bigint | string;
            max: bigint | string;
          }
        )).catch(console.error);
      }
    });
  }

  public subscribeToGracePeriodSetEvent(
    callback: (data: { grace: bigint | string }) => void | Promise<void>
  ): Promise<() => void> {
    return this._program.api.gearEvents.subscribeToGearEvent('UserMessageSent', ({ data: { message } }) => {
      if (!message.source.eq(this._program.programId) || !message.destination.eq(ZERO_ADDRESS)) return;
      const payload = message.payload.toHex();
      if (getServiceNamePrefix(payload) === 'Service' && getFnNamePrefix(payload) === 'GracePeriodSet') {
        void Promise.resolve(callback(
          this._program.registry.createType('(String, String, GracePeriodSet)', message.payload)[2].toJSON() as {
            grace: bigint | string;
          }
        )).catch(console.error);
      }
    });
  }

  public subscribeToNamesReservedEvent(
    callback: (data: { labels: number[][] }) => void | Promise<void>
  ): Promise<() => void> {
    return this._program.api.gearEvents.subscribeToGearEvent('UserMessageSent', ({ data: { message } }) => {
      if (!message.source.eq(this._program.programId) || !message.destination.eq(ZERO_ADDRESS)) return;
      const payload = message.payload.toHex();
      if (getServiceNamePrefix(payload) === 'Service' && getFnNamePrefix(payload) === 'NamesReserved') {
        void Promise.resolve(callback(
          this._program.registry.createType('(String, String, NamesReserved)', message.payload)[2].toJSON() as {
            labels: number[][];
          }
        )).catch(console.error);
      }
    });
  }

  public subscribeToWithdrawnEvent(
    callback: (data: { to: ActorId; amount: bigint | string }) => void | Promise<void>
  ): Promise<() => void> {
    return this._program.api.gearEvents.subscribeToGearEvent('UserMessageSent', ({ data: { message } }) => {
      if (!message.source.eq(this._program.programId) || !message.destination.eq(ZERO_ADDRESS)) return;
      const payload = message.payload.toHex();
      if (getServiceNamePrefix(payload) === 'Service' && getFnNamePrefix(payload) === 'Withdrawn') {
        void Promise.resolve(callback(
          this._program.registry.createType('(String, String, Withdrawn)', message.payload)[2].toJSON() as {
            to: ActorId;
            amount: bigint | string;
          }
        )).catch(console.error);
      }
    });
  }
}
