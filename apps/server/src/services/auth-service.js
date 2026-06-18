import { readStore } from "../data/store.js";
import { signUserToken, verifyPassword } from "../utils/auth.js";

export function login({ username, password }) {
  const store = readStore();
  const user = store.users.find((entry) => entry.username === username);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return null;
  }

  return {
    token: signUserToken(user),
    user: sanitizeUser(user, store.categories)
  };
}

export function sanitizeUser(user, categories) {
  const ownedCategories = categories.filter((category) => category.ownerUserIds.includes(user.id));
  const dedupedCategories = ownedCategories.filter((category, index, list) => {
    return list.findIndex((entry) => entry.name === category.name) === index;
  });

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    categoryIds: dedupedCategories.map((entry) => entry.id),
    categories: dedupedCategories
  };
}
