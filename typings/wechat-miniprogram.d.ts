declare const wx: {
  getStorageSync(key: string): string;
  setStorageSync(key: string, value: string): void;
  showToast(options: { title: string; icon?: string }): void;
  navigateTo(options: { url: string }): void;
};

declare function Page(options: Record<string, any>): void;

declare function Component(options: Record<string, any>): void;

declare function App(options: Record<string, any>): void;

declare module '*.json' {
  const value: any;
  export default value;
}
