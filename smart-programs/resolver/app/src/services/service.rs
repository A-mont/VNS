              
#![no_std]
#![allow(static_mut_refs)]

use sails_rs::{
    prelude::*,
    gstd::{msg, exec},
    collections::HashMap,
};
use sails_rs::calls::ActionIo; 

pub type Node = [u8; 32];
pub type Addr = ActorId;

/// State struct for the Resolver contract
#[derive(Debug, Clone, Default)]
pub struct ResolverState {
    pub addresses: HashMap<Node, Addr>,
    pub texts: HashMap<(Node, String), String>,
    pub contenthashes: HashMap<Node, Vec<u8>>,
    pub operators: HashMap<Node, Vec<Addr>>,
    pub registry: Addr,
}

/// All contract events
#[derive(Debug, Clone, Encode, Decode, TypeInfo, PartialEq, Eq)]
#[codec(crate = sails_rs::scale_codec)]
#[scale_info(crate = sails_rs::scale_info)]
pub enum ResolverEvent {
    AddrChanged(Node, Addr),
    TextChanged(Node, String, String),
    ContenthashChanged(Node, Vec<u8>),
    OperatorSet(Node, Addr, bool),
}

/// Arguments for address/text/content queries
#[derive(Debug, Clone, Encode, Decode, TypeInfo, PartialEq, Eq)]
#[codec(crate = sails_rs::scale_codec)]
#[scale_info(crate = sails_rs::scale_info)]
pub struct AddrQueryArgs {
    pub node: Node,
}

#[derive(Debug, Clone, Encode, Decode, TypeInfo, PartialEq, Eq)]
#[codec(crate = sails_rs::scale_codec)]
#[scale_info(crate = sails_rs::scale_info)]
pub struct TextQueryArgs {
    pub node: Node,
    pub key: String,
}

#[derive(Debug, Clone, Encode, Decode, TypeInfo, PartialEq, Eq)]
#[codec(crate = sails_rs::scale_codec)]
#[scale_info(crate = sails_rs::scale_info)]
pub struct ContenthashQueryArgs {
    pub node: Node,
}

#[derive(Debug, Clone, Encode, Decode, TypeInfo, PartialEq, Eq)]
#[codec(crate = sails_rs::scale_codec)]
#[scale_info(crate = sails_rs::scale_info)]
pub struct OperatorQueryArgs {
    pub node: Node,
    pub operator: Addr,
}

/// Contract state pointer
pub static mut RESOLVER_STATE: Option<ResolverState> = None;

// Helper functions for authorization/ownership

fn state_mut() -> &'static mut ResolverState {
    let s = unsafe { RESOLVER_STATE.as_mut() };
    debug_assert!(s.is_some(), "State not initialized");
    unsafe { s.unwrap_unchecked() }
}
fn state_ref() -> &'static ResolverState {
    let s = unsafe { RESOLVER_STATE.as_ref() };
    debug_assert!(s.is_some(), "State not initialized");
    unsafe { s.unwrap_unchecked() }
}

async fn check_can_modify(node: &Node) {
    let caller = msg::source();
    let state = state_ref();

    let request = ("owner".to_string(), node.clone()).encode();
    let bytes_reply = msg::send_bytes_for_reply(state.registry, request, 0, 0)
        .expect("send failed")
        .await
        .expect("reply failed");
    let owner: Addr = decode_owner_reply(bytes_reply);
    if owner == caller {
        return;
    }

    // Check if caller is operator
    let operators = state.operators.get(node);
    if let Some(ops) = operators {
        if ops.contains(&caller) {
            return;
        }
    }
    panic!("Not authorized");
}

// Decodes the reply from registry's "owner" query
fn decode_owner_reply(bytes: Vec<u8>) -> Addr {
    ActorId::decode(&mut &bytes[..]).expect("Failed to decode registry reply")
}

#[derive(Default)]
pub struct Service;

impl Service {
    /// Seed/init: must provide registry address
    pub fn seed(registry: Addr) {
        unsafe {
            RESOLVER_STATE = Some(ResolverState {
                registry,
                ..Default::default()
            })
        }
    }
}

#[sails_rs::service(events = ResolverEvent)]
impl Service {
    pub fn new() -> Self {
        Self
    }

    /// Set the resolved address for a node (must be owner or operator)
    pub async fn set_addr(&mut self, node: Node, addr: Addr) -> ResolverEvent {
        check_can_modify(&node).await;
        let state = state_mut();
        state.addresses.insert(node, addr);
        self.emit_event(ResolverEvent::AddrChanged(node, addr)).expect("event emission failed"); 
        ResolverEvent::AddrChanged(node, addr)
    }

    /// Set a text value for a node
    pub async fn set_text(&mut self, node: Node, key: String, value: String) -> ResolverEvent {
       
        assert!(key.len() <= 256, "key length exceeds 256 characters"); 
        assert!(value.len() <= 1024, "value length exceeds 1024 characters"); 

        check_can_modify(&node).await;
        let state = state_mut();
        state.texts.insert((node, key.clone()), value.clone());

       
        assert!(state.texts.len() <= 1000, "texts map size limit exceeded"); 

        self.emit_event(ResolverEvent::TextChanged(node, key.clone(), value.clone())).expect("event emission failed"); 
    }

    /// Set contenthash for a node
    pub async fn set_contenthash(&mut self, node: Node, data: Vec<u8>) -> ResolverEvent {
       
        assert!(data.len() <= 2048, "contenthash data size exceeds 2048 bytes"); 

        check_can_modify(&node).await;
        let state = state_mut();
        state.contenthashes.insert(node, data.clone());

      
        assert!(state.contenthashes.len() <= 1000, "contenthashes map size limit exceeded"); 

        self.emit_event(ResolverEvent::ContenthashChanged(node, data.clone())).expect("event emission failed"); 
        ResolverEvent::ContenthashChanged(node, data)
    }

    /// Set/unset an operator for a node (can only be called by owner)
    pub async fn set_operator(&mut self, node: Node, operator: Addr, enabled: bool) -> ResolverEvent {
        // Only owner may call (not other operators!)
        let state = state_ref();

        // Query registry for node owner
        let request = ("owner".to_string(), node.clone()).encode();
        let bytes_reply = msg::send_bytes_for_reply(state.registry, request, 0, 0)
            .expect("send failed")
            .await
            .expect("reply failed");
        let owner: Addr = decode_owner_reply(bytes_reply);

        if msg::source() != owner {
            panic!("Only node owner can set operators");
        }
        let state = state_mut();
        let operators = state.operators.entry(node).or_default();

        const MAX_OPERATORS: usize = 100;

        if enabled {
            if !operators.contains(&operator) {
                assert!(operators.len() < MAX_OPERATORS, "operators list size limit exceeded"); 
                operators.push(operator);
            }
        } else {
            if let Some(pos) = operators.iter().position(|x| x == &operator) {
                operators.remove(pos);
            }
        }
        self.emit_event(ResolverEvent::OperatorSet(node, operator, enabled)).expect("event emission failed"); 
        ResolverEvent::OperatorSet(node, operator, enabled)
    }

    /// QUERY: Get address for a node
    pub fn addr_of(&self, node: Node) -> Option<Addr> {
        state_ref().addresses.get(&node).cloned()
    }

    /// QUERY: Get a text record for a node and key
    pub fn text_of(&self, node: Node, key: String) -> Option<String> {
       
        if key.len() > 256 {
            return None;
        }
        state_ref().texts.get(&(node, key)).cloned()
    }

    /// QUERY: Get contenthash for a node
    pub fn contenthash_of(&self, node: Node) -> Option<Vec<u8>> {
        state_ref().contenthashes.get(&node).cloned()
    }

    /// QUERY: Is addr an operator for node
    pub fn is_operator(&self, node: Node, operator: Addr) -> bool {
        state_ref()
            .operators
            .get(&node)
            .map(|ops| ops.contains(&operator))
            .unwrap_or(false)
    }
}