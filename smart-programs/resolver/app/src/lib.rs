
#![no_std]
use sails_rs::prelude::*;
pub mod services;

use services::service::Service;

pub struct Program;

#[program]
impl Program {
    /// Construct a new Resolver program. Must supply the registry contract address.
    pub fn new(registry: ActorId) -> Self {
        Service::seed(registry);
        Self
    }

    #[route("Service")]
    pub fn service(&self) -> Service {
        Service::new()
    }
}
