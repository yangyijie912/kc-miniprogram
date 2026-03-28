declare type WxCallback = () => void;

declare type WxFileSystemManager = {
  writeFile(options: {
    filePath: string;
    data: string;
    encoding?: string;
    success?: WxCallback;
    fail?: WxCallback;
  }): void;
};

declare const wx: {
  env: {
    USER_DATA_PATH: string;
  };
  getStorageSync(key: string): any;
  setStorageSync(key: string, value: string): void;
  showToast(options: { title: string; icon?: string }): void;
  navigateTo(options: { url: string }): void;
  openDocument(options: { filePath: string; success?: WxCallback; fail?: WxCallback }): void;
  getFileSystemManager(): WxFileSystemManager;
};

declare function Page(options: Record<string, any>): void;

declare function Component(options: Record<string, any>): void;

declare function App(options: Record<string, any>): void;

declare module '*.json' {
  const value: any;
  export default value;
}
