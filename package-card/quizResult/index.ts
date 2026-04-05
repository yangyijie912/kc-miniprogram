import { jsonToUrlParam } from '../utils/jsonToUrl';
import type { quizQuery, QuizResultSummary } from '../../types/quiz';

Page({
  data: {
    quizResult: {
      total: 0,
      unknown: 0,
      fuzzy: 0,
      mastered: 0,
    } as QuizResultSummary,
    quizOptions: {} as Partial<quizQuery>,
  },

  onLoad(options) {
    this.setData({
      quizOptions: options,
    });
  },

  onShow() {
    const resultStr = wx.getStorageSync('quizResult');
    if (resultStr) {
      const parsedResult = JSON.parse(resultStr);
      this.setData({
        quizResult: parsedResult,
      });
    }
  },

  // 重新开始测验，跳转回测验页面并传递相同的测验选项
  restartQuiz() {
    wx.redirectTo({
      url: `/package-card/quiz/index?${jsonToUrlParam(this.data.quizOptions)}`,
    });
  },

  // 返回首页
  toHome() {
    // wx.navigateBack({
    //   delta: 1,
    // });
    wx.switchTab({
      url: '/pages/index/index',
    });
  },
});
