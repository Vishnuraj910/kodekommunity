import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";

const ALGORITHM = "scrypt";
const COST = 2 ** 17;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const SALT_BYTES = 16;
const DERIVED_KEY_BYTES = 64;
const MAX_MEMORY_BYTES = 256 * 1024 * 1024;

const deriveKey = async (
  plaintext: string,
  salt: Buffer,
  cost: number,
  blockSize: number,
  parallelization: number,
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scryptCallback(
      plaintext,
      salt,
      DERIVED_KEY_BYTES,
      {
        N: cost,
        r: blockSize,
        p: parallelization,
        maxmem: MAX_MEMORY_BYTES,
      },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      },
    );
  });

export const hashPassword = async (plaintext: string): Promise<string> => {
  const salt = randomBytes(SALT_BYTES);
  const derivedKey = await deriveKey(
    plaintext,
    salt,
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
  );

  return [
    ALGORITHM,
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join("$");
};

export const verifyPassword = async (
  plaintext: string,
  storedHash: string,
): Promise<boolean> => {
  const [algorithm, rawCost, rawBlockSize, rawParallelization, rawSalt, rawKey] =
    storedHash.split("$");
  if (
    algorithm !== ALGORITHM ||
    !rawCost ||
    !rawBlockSize ||
    !rawParallelization ||
    !rawSalt ||
    !rawKey
  ) {
    return false;
  }

  const cost = Number(rawCost);
  const blockSize = Number(rawBlockSize);
  const parallelization = Number(rawParallelization);
  if (
    cost !== COST ||
    blockSize !== BLOCK_SIZE ||
    parallelization !== PARALLELIZATION
  ) {
    return false;
  }

  try {
    const expected = Buffer.from(rawKey, "base64url");
    if (expected.length !== DERIVED_KEY_BYTES) return false;
    const actual = await deriveKey(
      plaintext,
      Buffer.from(rawSalt, "base64url"),
      cost,
      blockSize,
      parallelization,
    );
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
};
