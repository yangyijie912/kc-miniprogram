import { jsonToUrlParam } from '@/package-card/utils/jsonToUrl';
import type { quizQuery, QuizResultSummary } from '@/types/quiz';

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

  // 结果页入口可能来自测验完成，也可能来自统计页回看；优先回上一页，无栈再兜底首页。
  toHome() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack({
        delta: 1,
      });
      return;
    }

    wx.switchTab({
      url: '/pages/index/index',
    });
  },
});
