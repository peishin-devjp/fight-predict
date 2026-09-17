import {
  argon2Sync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import {
  deserialize,
  serialize,
} from "@phc/format";

const ARGON2_VERSION = 19;
const ARGON2_MEMORY = 65536;
const ARGON2_PASSES = 3;
const ARGON2_PARALLELISM = 4;
const ARGON2_SALT_LENGTH = 16;
const ARGON2_HASH_LENGTH = 32;

export const hashPassword = async (
  password: string
): Promise<string> => {
  const salt = randomBytes(
    ARGON2_SALT_LENGTH
  );

  const hash = argon2Sync(
    "argon2id",
    {
      message: password,
      nonce: salt,
      parallelism: ARGON2_PARALLELISM,
      tagLength: ARGON2_HASH_LENGTH,
      memory: ARGON2_MEMORY,
      passes: ARGON2_PASSES,
    }
  );

  return serialize({
    id: "argon2id",
    version: ARGON2_VERSION,
    params: {
      m: ARGON2_MEMORY,
      t: ARGON2_PASSES,
      p: ARGON2_PARALLELISM,
    },
    salt,
    hash,
  });
};

export const verifyPassword = async (
  passwordHash: string,
  password: string
): Promise<boolean> => {
  try {
    const parsed =
      deserialize(passwordHash);

    if (
      parsed.id !== "argon2id" ||
      parsed.version !== ARGON2_VERSION ||
      parsed.params?.m !== ARGON2_MEMORY ||
      parsed.params?.t !== ARGON2_PASSES ||
      parsed.params?.p !==
        ARGON2_PARALLELISM ||
      !parsed.salt ||
      !parsed.hash ||
      parsed.salt.length === 0 ||
      parsed.hash.length !==
        ARGON2_HASH_LENGTH
    ) {
      return false;
    }

    const actualHash = argon2Sync(
      "argon2id",
      {
        message: password,
        nonce: parsed.salt,
        parallelism:
          ARGON2_PARALLELISM,
        tagLength: ARGON2_HASH_LENGTH,
        memory: ARGON2_MEMORY,
        passes: ARGON2_PASSES,
      }
    );

    return timingSafeEqual(
      actualHash,
      parsed.hash
    );
  } catch {
    // 不正なPHC文字列は認証失敗として扱う
    return false;
  }
};
