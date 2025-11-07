/// <reference types="vite/client" />

declare module '*.module.css' {
	const classes: { readonly [key: string]: string };
	export default classes;
}

declare module '*.css' {
        const classes: { readonly [key: string]: string };
        export default classes;
}

interface ElectronAPI {
        getApiBaseUrl(): string | undefined;
}

declare interface Window {
        electronAPI?: ElectronAPI;
}


