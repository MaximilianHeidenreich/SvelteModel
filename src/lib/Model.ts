import { get, writable } from 'svelte/store';

export type Updater<T> = (value: T) => T;
export interface OpError {
	msg: string;
	meta?: any;
}
export interface OpResult {
	meta?: any;
}
export interface SaveFunction<T> {
	(o: T): Promise<OpError | OpResult>;
}
export interface LoadFunction<T> {
	(): Promise<T | undefined>;
}
export interface MutateFunction<T> {
	(o: Object): void;
}
export interface OnInitCallback<T> {
	(o: T | undefined): void;
}

export interface ModelOptions<T> {
	/**
	 *
	 */
	allowUndefinedData?: boolean;
	loadOnCreate?: boolean;
	saveFn?: SaveFunction<T>;
	loadFn?: LoadFunction<T>;
	mutateFn?: MutateFunction<T>;

	/**
	 * Useful when using loadOnCreate and wanting to change app state when initial loading has completed.
	 */
	onInitialized?: OnInitCallback<T>; // TODO!: Deprecate
}

export function createModel<T>(options?: ModelOptions<T>) {
	const store = (() => {
		// Handle opts
		const DEFAULT_OPTS: ModelOptions<T> = {
			allowUndefinedData: false,
			loadOnCreate: true
		};
		let opts = options ? { ...options, ...DEFAULT_OPTS } : DEFAULT_OPTS;

		// Svelte Store
		const { subscribe, set, update } = writable<T>();

		/**
		 * Loads data from loadFn and sets store value to result.
		 *
		 * @returns The loaded data or undefined if not data
		 */
		const cLoad = async (): Promise<T | undefined> => {
			if (!opts.loadFn) {
				console.warn("[MODEL] Trying to load model data without a 'loadFn' option!");
				return;
			}
			let loadedData = await opts.loadFn();

			if (loadedData) {
				// @ts-ignore
				set(loadedData);
				return loadedData;
			} else {
				return undefined;
			}
		};

		/**
		 * Sets the store data, prevent undefined data (optional) and calls saveFn for persistance.
		 *
		 * @param data The new data value
		 * @returns
		 */
		const cSet = (data: T) => {
			if (!data && !opts.allowUndefinedData) {
				console.warn(
					"[MODEL] Trying to set undefined data without 'allowUndefinedData = true' option!"
				);
				console.trace(
					"[MODEL] Trying to set undefined data without 'allowUndefinedData = true' option!"
				);
				return;
			}
			set(data);
			if (opts.saveFn) opts.saveFn(data);
		};

		/**
		 * Updates the store value and calls saveFn for persistance.
		 *
		 * @param updater The updater function
		 */
		const cUpdate = (updater: Updater<T>) => {
			update((v) => {
				v = updater(v);
				if (opts.saveFn) opts.saveFn(v);
				return v;
			});
		};

		/**
		 * Mutates the store data based on keys in mutation object & calls saveFn for persistance.
		 *
		 * @param mutation The mutation object -> keys will override store data keys
		 */
		const mutate = (mutation: T) => {
			// Custom mut fn
			if (opts.mutateFn) {
				opts.mutateFn(mutation);
				return;
			}

			// Default mut fn
			update((v) => {
				Object.keys(mutation).forEach((k) => {
					// @ts-ignore
					if (k in v) v[k] = mutation[k];
					else {
						console.warn(`[MODEL] Trying to mutate model with unknown key '${k}'!`);
						console.trace(`[MODEL] Trying to mutate model with unknown key '${k}'!`);
					}
				});
				/*Object.keys(mutation).forEach((k) => {
                    if (k.indexOf(".") !== -1) {
                        const inner = (o: , key) => {
                            o[]
                        }
                        for (let i = 0; i < (k.split(".").length - 1); i++) {

                        }
                        v[k] = mutation[k];
                    }
                    // @ts-ignore
                    v[k] = mutation[k];
                });*/
				if (opts.saveFn) opts.saveFn(v);
				return v;
			});
		};

		// Initialization
		const INITIALIZED = new Promise(async (resolve, reject) => {
			if (opts.loadOnCreate && opts.loadFn) {
				let l = await cLoad();
				if (l) resolve(l);
				else reject(undefined);
			} else {
				resolve({});
			}
		});

		return {
			subscribe,
			update: cUpdate, // Default svelte update        -> Does not call saveFn
			mutate, // Use to mutate data & save it -> Calls savFn
			set: cSet, // Custom setFn

			load: cLoad, // Loads and sets value from loadFn
			initialized: INITIALIZED // Promise which can be used to change app state on end of initialization / loading TODO: Exapmle with .catch -> reload
		};
	})();

	return {
		subscribe: store.subscribe,
		update: store.update,
		mutate: store.mutate,
		set: store.set,
		get: async (): Promise<T> => await get(store),

		load: store.load,
		initialized: store.initialized
	};
}
