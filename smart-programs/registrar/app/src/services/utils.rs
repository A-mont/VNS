use core::fmt::Debug;
use gstd::{ext, format};
use sails_rs::prelude::*;


pub fn panicking<T, E: Debug, F: FnOnce() -> Result<T, E>>(f: F) -> T {
    match f() {
        Ok(v) => v,
        Err(e) => panic(e),
    }
}

pub fn panic(err: impl Debug) -> ! {
    ext::panic(&format!("{err:?}"))
}

#[inline(always)]
fn blake2<const N: usize>(data: &[u8]) -> [u8; N] {
    blake2b_simd::Params::new()
        .hash_length(N)
        .hash(data)
        .as_bytes()
        .try_into()
        .expect("slice is always the necessary length")
}

pub fn blake2_256(data: &[u8]) -> [u8; 32] {
    blake2(data)
}

