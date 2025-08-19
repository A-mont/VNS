
#![no_std]
use sails_rs::prelude::*;
pub mod services;
use services::service::{Service, InitRegistrar};

pub struct Program;

#[program]
impl Program {
    pub fn new(init: InitRegistrar) -> Self {
        Service::seed(init);
        Self
    }

    #[route("Service")]
    pub fn service(&self) -> Service {
        Service::new()
    }
}
