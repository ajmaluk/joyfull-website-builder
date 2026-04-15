// Polyfill for localStorage to work on server-side
if (typeof window === 'undefined') {
    global.localStorage = {
        getItem: () => null,
        setItem: () => { },
        removeItem: () => { },
        clear: () => { },
        length: 0,
        key: () => null,
    } as Storage;
}
