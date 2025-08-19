
#![no_std]
#![allow(static_mut_refs)]

use sails_rs::{
    prelude::*,
    gstd::msg,
    collections::HashMap,
};
use sails_rs::collections::HashSet;

/// Type representing a node (e.g. namehash for VNS)
pub type Node = U256;


#[derive(Debug, Clone, Encode, Decode, TypeInfo, PartialEq, Eq)]
#[codec(crate = sails_rs::scale_codec)]
#[scale_info(crate = sails_rs::scale_info)]
pub enum RegistryEvent {
    NewOwner { node: Node, owner: ActorId },
    NewResolver { node: Node, resolver: ActorId },
    NewTTL { node: Node, ttl: u64 },
    NewSubnodeOwner { parent: Node, label: U256, subnode: Node, owner: ActorId },
    ControllerAdded(ActorId),
    ControllerRemoved(ActorId),
}

#[derive(Debug, Encode, Decode, TypeInfo, Clone, Default)]
#[codec(crate = sails_rs::scale_codec)]
#[scale_info(crate = sails_rs::scale_info)]
pub struct RegistryState {
    pub admin: ActorId,
    pub owners: HashMap<Node, ActorId>,
    pub resolvers: HashMap<Node, ActorId>,
    pub ttls: HashMap<Node, u64>,
    pub controllers: HashSet<ActorId>,
}

#[derive(Debug, Encode, Decode, TypeInfo, Clone)]
#[codec(crate = sails_rs::scale_codec)]
#[scale_info(crate = sails_rs::scale_info)]
pub struct IoRegistryState {
    pub admin: ActorId,
    pub controllers: Vec<ActorId>,
    pub owners: Vec<(Node, ActorId)>,
    pub resolvers: Vec<(Node, ActorId)>,
    pub ttls: Vec<(Node, u64)>,
}


#[derive(Debug, Encode, Decode, Clone, TypeInfo)]
#[codec(crate = sails_rs::scale_codec)]
#[scale_info(crate = sails_rs::scale_info)]
pub struct InitRegistry {
    pub admin: ActorId,
    pub root_node: Node,
    pub root_owner: ActorId,
}

static mut REGISTRY_STATE: Option<RegistryState> = None;

impl RegistryState {
    pub fn state_mut() -> &'static mut RegistryState {
        let s = unsafe { REGISTRY_STATE.as_mut() };
        debug_assert!(s.is_some(), "Registry state not initialized");
        unsafe { s.unwrap_unchecked() }
    }
    pub fn state_ref() -> &'static RegistryState {
        let s = unsafe { REGISTRY_STATE.as_ref() };
        debug_assert!(s.is_some(), "Registry state not initialized");
        unsafe { s.unwrap_unchecked() }
    }
    pub fn is_owner_or_controller(&self, node: &Node, actor: &ActorId) -> bool {
        self.owners.get(node).map_or(false, |x| x == actor) || self.controllers.contains(actor)
    }
    pub fn is_admin(&self, actor: &ActorId) -> bool {
        &self.admin == actor
    }
}

impl From<RegistryState> for IoRegistryState {
    fn from(s: RegistryState) -> Self {
        Self {
            admin: s.admin,
            controllers: s.controllers.iter().cloned().collect(),
            owners: s.owners.iter().map(|(k, v)| (*k, *v)).collect(),
            resolvers: s.resolvers.iter().map(|(k, v)| (*k, *v)).collect(),
            ttls: s.ttls.iter().map(|(k, v)| (*k, *v)).collect(),
        }
    }
}

#[derive(Default)]
pub struct Service;

impl Service {
    pub fn seed(init: InitRegistry) {
        unsafe {
            let mut controllers = HashSet::new();
            REGISTRY_STATE = Some(RegistryState {
                admin: init.admin,
                owners: [(init.root_node, init.root_owner)].into(),
                resolvers: HashMap::new(),
                ttls: HashMap::new(),
                controllers,
            });
        }
    }
}

#[sails_rs::service(events = RegistryEvent)]
impl Service {
    pub fn new() -> Self { Self }

    /// Set the owner for a node. Only owner or controller may call.
    pub fn set_owner(&mut self, node: Node, new_owner: ActorId) -> RegistryEvent {
        let mut s = RegistryState::state_mut();
        let caller = msg::source();
        if !s.is_owner_or_controller(&node, &caller) {
            panic!("Not owner or controller");
        }
        s.owners.insert(node, new_owner);
        self.emit_event(RegistryEvent::NewOwner { node, owner: new_owner })
            .expect("Event failed");
        RegistryEvent::NewOwner { node, owner: new_owner }
    }

    /// Set the resolver for a node. Only owner or controller may call.
    pub fn set_resolver(&mut self, node: Node, resolver: ActorId) -> RegistryEvent {
        let mut s = RegistryState::state_mut();
        let caller = msg::source();
        if !s.is_owner_or_controller(&node, &caller) {
            panic!("Not owner or controller");
        }
        s.resolvers.insert(node, resolver);
        self.emit_event(RegistryEvent::NewResolver { node, resolver })
            .expect("Event failed");
        RegistryEvent::NewResolver { node, resolver }
    }

    /// Set the TTL for a node. Only owner or controller may call.
    pub fn set_ttl(&mut self, node: Node, ttl: u64) -> RegistryEvent {
        let mut s = RegistryState::state_mut();
        let caller = msg::source();
        if !s.is_owner_or_controller(&node, &caller) {
            panic!("Not owner or controller");
        }
        s.ttls.insert(node, ttl);
        self.emit_event(RegistryEvent::NewTTL { node, ttl })
            .expect("Event failed");
        RegistryEvent::NewTTL { node, ttl }
    }

    /// Set the owner for a subnode by specifying parent & label. Only parent owner or controller may call.
    pub fn set_subnode_owner(&mut self, parent: Node, label: U256, new_owner: ActorId) -> RegistryEvent {
        let mut s = RegistryState::state_mut();
        let caller = msg::source();
        if !s.is_owner_or_controller(&parent, &caller) {
            panic!("Not parent owner or controller");
        }
        // Derive new node: hash(parent, label)
        let mut node_bytes = [0u8; 64];
        parent.to_little_endian(&mut node_bytes[0..32]);
        label.to_little_endian(&mut node_bytes[32..64]);
        let subnode = sails_rs::prelude::hash_bytes::<Node>(&node_bytes);
        s.owners.insert(subnode, new_owner);
        self.emit_event(RegistryEvent::NewSubnodeOwner { parent, label, subnode, owner: new_owner })
            .expect("Event failed");
        RegistryEvent::NewSubnodeOwner { parent, label, subnode, owner: new_owner }
    }

    /// Add a controller. Only admin may call.
    pub fn add_controller(&mut self, controller: ActorId) -> RegistryEvent {
        let mut s = RegistryState::state_mut();
        let caller = msg::source();
        if !s.is_admin(&caller) {
            panic!("Not admin");
        }
        s.controllers.insert(controller);
        self.emit_event(RegistryEvent::ControllerAdded(controller))
            .expect("Event failed");
        RegistryEvent::ControllerAdded(controller)
    }

    /// Remove a controller. Only admin may call.
    pub fn remove_controller(&mut self, controller: ActorId) -> RegistryEvent {
        let mut s = RegistryState::state_mut();
        let caller = msg::source();
        if !s.is_admin(&caller) {
            panic!("Not admin");
        }
        s.controllers.remove(&controller);
        self.emit_event(RegistryEvent::ControllerRemoved(controller))
            .expect("Event failed");
        RegistryEvent::ControllerRemoved(controller)
    }

    /// OWNER QUERY: Return the owner for a node.
    pub fn owner_of(&self, node: Node) -> Option<ActorId> {
        RegistryState::state_ref().owners.get(&node).copied()
    }

    /// RESOLVER QUERY: Return the resolver for a node.
    pub fn resolver_of(&self, node: Node) -> Option<ActorId> {
        RegistryState::state_ref().resolvers.get(&node).copied()
    }

    /// TTL QUERY: Return the TTL for a node.
    pub fn ttl_of(&self, node: Node) -> Option<u64> {
        RegistryState::state_ref().ttls.get(&node).copied()
    }

    /// Query the whole on-chain registry state.
    pub fn query_state(&self) -> IoRegistryState {
        RegistryState::state_ref().clone().into()
    }
}
