export function pxToRpx(px: number) {
  const systemInfo = wx.getWindowInfo();
  return (px / systemInfo.screenWidth) * 750;
}

export function getWindowStyles() {
  //   wx.getSystemSetting wx.getAppAuthorizeSetting wx.getDeviceInfo wx.getWindowInfo wx.getAppBaseInfo
  const systemInfo = wx.getWindowInfo();
  const menu = wx.getMenuButtonBoundingClientRect();

  const { screenHeight, windowHeight, statusBarHeight, safeArea } = systemInfo;

  // 计算导航栏高度(包括状态栏和菜单按钮的高度)
  const navBarHeight = (menu.top - statusBarHeight) * 2 + menu.height;
  // 计算顶部安全区域高度
  const topInset = statusBarHeight + navBarHeight;
  // 计算底部安全区域高度
  const bottomInset = screenHeight - safeArea.bottom;

  return {
    maxHeight: pxToRpx(windowHeight - topInset - bottomInset),
    navBarHeight: pxToRpx(navBarHeight),
  };
}
