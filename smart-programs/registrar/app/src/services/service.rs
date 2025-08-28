
#![no_std]
#![allow(static_mut_refs)]

use sails_rs::{
    prelude::*,
    gstd::msg,
    collections::{HashMap},
};
use sails_rs::calls::ActionIo;

use crate::services::utils::*;

pub type Node = U256;
pub type Label = Vec<u8>;

const MAX_LABEL_LENGTH: usize = 256; 
const MAX_LABELS_RESERVED: usize = 100; 
const MAX_COMMITMENTS: usize = 1000; 

#[derive(Debug, Clone, Encode, Decode, TypeInfo)]
#[codec(crate = gstd::codec)]
#[scale_info(crate = gstd::scale_info)]
pub enum RegistrarEvent {
    CommitSubmitted { commitment: [u8; 32], timestamp: u64 },
    NameRegistered { name: Label, owner: ActorId, expires: u64, cost: u128 },
    NameRenewed { name: Label, expires: u64, cost: u128 },
    PricesSet { base: u128, premium: u128 },
    CommitAgesSet { min: u64, max: u64 },
    GracePeriodSet { grace: u64 },
    NamesReserved { labels: Vec<Label> },
    Withdrawn { to: ActorId, amount: u128 },
}

#[derive(Debug, Default)]
pub struct RegistrarState {
    pub registry: ActorId,
    pub tld_node: Node,
    pub commits: HashMap<[u8; 32], u64>,
    pub expires: HashMap<Label, u64>,
    pub reserved: Vec<Label>,
    pub base_price: u128,
    pub premium_price: u128,
    pub min_commit_age: u64,
    pub max_commit_age: u64,
    pub grace_period: u64,
    pub controller: ActorId,
    pub balance: u128,
}

#[derive(Debug, Encode, Decode, TypeInfo, Clone)]
#[codec(crate = sails_rs::scale_codec)]
#[scale_info(crate = sails_rs::scale_info)]
pub struct IoRegistrarState {
    pub registry: ActorId,
    pub tld_node: Node,
    pub commits: Vec<([u8; 32], u64)>,
    pub expires: Vec<(Label, u64)>,
    pub reserved: Vec<Label>,
    pub base_price: u128,
    pub premium_price: u128,
    pub min_commit_age: u64,
    pub max_commit_age: u64,
    pub grace_period: u64,
    pub controller: ActorId,
    pub balance: u128,
}

#[derive(Debug, Encode, Decode, Clone, TypeInfo)]
#[codec(crate = sails_rs::scale_codec)]
#[scale_info(crate = sails_rs::scale_info)]
pub struct InitRegistrar {
    pub registry: ActorId,
    pub tld_node: Node,
    pub controller: ActorId,
    pub base_price: u128,
    pub premium_price: u128,
    pub min_commit_age: u64,
    pub max_commit_age: u64,
    pub grace_period: u64,
}

static mut REGISTRAR_STATE: Option<RegistrarState> = None;

impl RegistrarState {
    pub fn state_mut() -> &'static mut RegistrarState {
        let s = unsafe { REGISTRAR_STATE.as_mut() };
        debug_assert!(s.is_some(), "Registrar state not initialized");
        unsafe { s.unwrap_unchecked() }
    }
    pub fn state_ref() -> &'static RegistrarState {
        let s = unsafe { REGISTRAR_STATE.as_ref() };
        debug_assert!(s.is_some(), "Registrar state not initialized");
        unsafe { s.unwrap_unchecked() }
    }
    pub fn is_controller(&self, actor: &ActorId) -> bool {
        &self.controller == actor
    }
    pub fn is_admin(&self, actor: &ActorId) -> bool {
        &self.controller == actor
    }
}

impl From<RegistrarState> for IoRegistrarState {
    fn from(s: RegistrarState) -> Self {
        Self {
            registry: s.registry,
            tld_node: s.tld_node,
            commits: s.commits.iter().map(|(k, v)| (*k, *v)).collect(),
            expires: s.expires.iter().map(|(k, v)| (k.clone(), *v)).collect(),
            reserved: s.reserved.iter().cloned().collect(),
            base_price: s.base_price,
            premium_price: s.premium_price,
            min_commit_age: s.min_commit_age,
            max_commit_age: s.max_commit_age,
            grace_period: s.grace_period,
            controller: s.controller,
            balance: s.balance,
        }
    }
}

pub struct Service;

impl Service {
    pub fn seed(init: InitRegistrar) {
        unsafe {
            REGISTRAR_STATE = Some(RegistrarState {
                registry: init.registry,
                tld_node: init.tld_node,
                commits: HashMap::new(),
                expires: HashMap::new(),
                reserved: Vec::new(),
                base_price: init.base_price,
                premium_price: init.premium_price,
                min_commit_age: init.min_commit_age,
                max_commit_age: init.max_commit_age,
                grace_period: init.grace_period,
                controller: init.controller,
                balance: 0,
            });
        }
    }
}

#[sails_rs::service(events = RegistrarEvent)]
impl Service {
    pub fn new() -> Self { Self }

    pub fn commit(&mut self, commitment: [u8; 32]) -> RegistrarEvent {
        let now = sails_rs::gstd::exec::block_timestamp();
        let s = RegistrarState::state_mut();
        if s.commits.contains_key(&commitment) {
            panic!("Commitment already exists");
        }
        if s.commits.len() >= MAX_COMMITMENTS {
            panic!("Too many commitments"); 
        }
        s.commits.insert(commitment, now);
        self.emit_event(RegistrarEvent::CommitSubmitted { commitment, timestamp: now })
            .expect("Event failed");
        RegistrarEvent::CommitSubmitted { commitment, timestamp: now }
    }

    /// Register a name after commit-reveal
    pub fn register(
        &mut self,
        name: Label,
        owner: ActorId,
        duration: u64,
        secret: [u8; 32],
        salt: [u8; 32],
        resolver: Option<ActorId>,
    ) -> RegistrarEvent {
        if name.len() > MAX_LABEL_LENGTH {
            panic!("Name too long"); 
        }
        let now = sails_rs::gstd::exec::block_timestamp();
        let s = RegistrarState::state_mut();

        if s.reserved.contains(&name) {
            panic!("Name is reserved");
        }

      
        let mut preimage = Vec::new();
        preimage.extend_from_slice(&name);
        preimage.extend_from_slice(owner.as_ref());
        preimage.extend_from_slice(&secret);
        preimage.extend_from_slice(&salt);
      
        let commitment = blake2_256(&preimage);

        let commit_time = s.commits.get(&commitment).copied().unwrap_or(0);
        if commit_time == 0 {
            panic!("No valid commitment");
        }
        let min_age = s.min_commit_age;
        let max_age = s.max_commit_age;
        if now < commit_time.checked_add(min_age).expect("Overflow in min age check") {
            panic!("Commitment too new");
        }
        if now > commit_time.checked_add(max_age).expect("Overflow in max age check") {
            panic!("Commitment expired");
        }

        let expires_at = s.expires.get(&name).copied().unwrap_or(0);
        if now <= expires_at.checked_add(s.grace_period).expect("Overflow in grace period check") {
            panic!("Name not available");
        }

        let price = Self::calc_price(&name, duration, s.base_price, s.premium_price);

        s.balance = s.balance.saturating_add(price); 

        let new_expiry = now.checked_add(duration).expect("Overflow in expiry calculation");
        s.expires.insert(name.clone(), new_expiry);

        s.commits.remove(&commitment);

        if let Some(resolver_addr) = resolver {
            let _ = resolver_addr;
        }

        self.emit_event(RegistrarEvent::NameRegistered {
            name: name.clone(),
            owner,
            expires: new_expiry,
            cost: price,
        }).expect("Event failed");
        RegistrarEvent::NameRegistered {
            name,
            owner,
            expires: new_expiry,
            cost: price,
        }
    }

    /// Renew a name
    pub fn renew(&mut self, name: Label, duration: u64) -> RegistrarEvent {
        if name.len() > MAX_LABEL_LENGTH {
            panic!("Name too long"); 
        }
        let now = sails_rs::gstd::exec::block_timestamp();
        let s = RegistrarState::state_mut();

        let expires_at = s.expires.get(&name).copied().unwrap_or(0);
        if now > expires_at.checked_add(s.grace_period).expect("Overflow in grace period check") {
            panic!("Name not renewable");
        }

        let price = Self::calc_price(&name, duration, s.base_price, s.premium_price);

        // Payment logic: for demo, just increment balance
        s.balance = s.balance.saturating_add(price); 

        let new_expiry = expires_at.checked_add(duration).expect("Overflow in expiry calculation");
        s.expires.insert(name.clone(), new_expiry);

        self.emit_event(RegistrarEvent::NameRenewed {
            name: name.clone(),
            expires: new_expiry,
            cost: price,
        }).expect("Event failed");
        RegistrarEvent::NameRenewed {
            name,
            expires: new_expiry,
            cost: price,
        }
    }

    /// Query if a name is available
    pub fn available(&self, name: Label) -> bool {
        if name.len() > MAX_LABEL_LENGTH {
            return false; 
        }
        let now = sails_rs::gstd::exec::block_timestamp();
        let s = RegistrarState::state_ref();
        let expires_at = s.expires.get(&name).copied().unwrap_or(0);
        !s.reserved.contains(&name) && now > expires_at.saturating_add(s.grace_period)
    }

    /// Query expiry of a name
    pub fn expiry_of(&self, name: Label) -> Option<u64> {
        if name.len() > MAX_LABEL_LENGTH {
            return None; 
        }
        RegistrarState::state_ref().expires.get(&name).copied()
    }

    /// Query price for a name and duration
    pub fn price(&self, name: Label, duration: u64) -> u128 {
        if name.len() > MAX_LABEL_LENGTH {
            return 0;
        }
        let s = RegistrarState::state_ref();
        Self::calc_price(&name, duration, s.base_price, s.premium_price)
    }

    /// Admin: set prices
    pub fn set_prices(&mut self, base: u128, premium: u128) -> RegistrarEvent {
        let s = RegistrarState::state_mut();
        let caller = msg::source();
        if !s.is_admin(&caller) {
            panic!("Not controller");
        }
        s.base_price = base;
        s.premium_price = premium;
        self.emit_event(RegistrarEvent::PricesSet { base, premium })
            .expect("Event failed");
        RegistrarEvent::PricesSet { base, premium }
    }

    /// Admin: set commit ages
    pub fn set_commit_ages(&mut self, min: u64, max: u64) -> RegistrarEvent {
        let s = RegistrarState::state_mut();
        let caller = msg::source();
        if !s.is_admin(&caller) {
            panic!("Not controller");
        }
        s.min_commit_age = min;
        s.max_commit_age = max;
        self.emit_event(RegistrarEvent::CommitAgesSet { min, max })
            .expect("Event failed");
        RegistrarEvent::CommitAgesSet { min, max }
    }

    /// Admin: set grace period
    pub fn set_grace_period(&mut self, grace: u64) -> RegistrarEvent {
        let s = RegistrarState::state_mut();
        let caller = msg::source();
        if !s.is_admin(&caller) {
            panic!("Not controller");
        }
        s.grace_period = grace;
        self.emit_event(RegistrarEvent::GracePeriodSet { grace })
            .expect("Event failed");
        RegistrarEvent::GracePeriodSet { grace }
    }

    /// Admin: reserve names
    pub fn reserve_names(&mut self, labels: Vec<Label>) -> RegistrarEvent {
        let s = RegistrarState::state_mut();
        let caller = msg::source();
        if !s.is_admin(&caller) {
            panic!("Not controller");
        }
        if labels.len() > MAX_LABELS_RESERVED {
            panic!("Too many labels to reserve"); 
        }
        for label in &labels {
            if label.len() > MAX_LABEL_LENGTH {
                panic!("Label too long"); 
            }
        }
        for label in &labels {
            s.reserved.push(label.clone());
        }
        self.emit_event(RegistrarEvent::NamesReserved { labels: labels.clone() })
            .expect("Event failed");
        RegistrarEvent::NamesReserved { labels }
    }

    /// Admin: withdraw balance
    pub fn withdraw(&mut self, to: ActorId, amount: u128) -> RegistrarEvent {
        let s = RegistrarState::state_mut();
        let caller = msg::source();
        if !s.is_admin(&caller) {
            panic!("Not controller");
        }
        if amount > s.balance {
            panic!("Insufficient balance");
        }
        s.balance = s.balance.saturating_sub(amount); 
      
        self.emit_event(RegistrarEvent::Withdrawn { to, amount })
            .expect("Event failed");
        RegistrarEvent::Withdrawn { to, amount }
    }

  

    fn calc_price(name: &Label, duration: u64, base: u128, premium: u128) -> u128 {
        let len = name.len() as u128;
        let premium_fee = if len < 5 { premium } else { 0 };
        base.saturating_add(premium_fee)
            .saturating_mul(duration as u128) 
    }
}
