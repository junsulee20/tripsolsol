// Mock Firebase implementation for Expo Go compatibility
export const auth = {
  currentUser: null,
  signInWithEmailAndPassword: () => Promise.resolve(),
  createUserWithEmailAndPassword: () => Promise.resolve(),
  signOut: () => Promise.resolve(),
  onAuthStateChanged: (callback: any) => {
    // Mock user for testing
    setTimeout(() => callback(null), 100);
    return () => {}; // unsubscribe function
  }
};

export const db = {
  collection: () => ({
    add: () => Promise.resolve({ id: 'mock-id' }),
    where: () => ({
      get: () => Promise.resolve({ empty: true, docs: [] })
    }),
    get: () => Promise.resolve({ docs: [] })
  })
};

export const storage = {
  ref: () => ({
    put: () => Promise.resolve(),
    getDownloadURL: () => Promise.resolve('mock-url')
  })
};

// Mock app export
const app = { name: 'mock-app' };
export default app; 