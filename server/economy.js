// Simple in-memory economy store
// In production, use a database (Redis/Postgres)

// Map<UserId, Balance>
const userBalances = new Map();

// Default starting balance for new users (e.g., 5 free minutes)
const DEFAULT_BALANCE = 5.0;

export const getBalance = (userId) => {
    if (!userBalances.has(userId)) {
        userBalances.set(userId, DEFAULT_BALANCE);
    }
    return userBalances.get(userId);
};

export const deductBalance = (userId, cost) => {
    const current = getBalance(userId);
    if (current < cost) {
        return false; // Insufficient funds
    }
    userBalances.set(userId, current - cost);
    return true;
};

export const addBalance = (userId, amount) => {
    const current = getBalance(userId);
    userBalances.set(userId, current + amount);
    return current + amount;
};
