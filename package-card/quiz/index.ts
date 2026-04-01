import { updateCard } from '../../services/cardService';
import {
  getFreedomQuizQuestions,
  getDailyQuizSession,
  updateDailyQuizSessionProgress,
} from '../../services/quizService';
import { jsonToUrlParam } from '../../utils/jsonToUrl';
import type { CardStatus, CardView } from '../../types/card';
import type { quizQuery, QuizResultSummary } from '../../types/quiz';

Page({
  data: {
    cardQueue: [] as CardView[],
    cardIndex: 0 as number,
    currentCard: {} as CardView & { tagText?: string },
    quizResult: {
      total: 0,
      unknown: 0,
      fuzzy: 0,
      mastered: 0,
    } as QuizResultSummary,
    quizOptions: {} as quizQuery,
    showAnswer: false as boolean,
  },

  toggleAnswer() {
    // 答案只能展示一次
    this.setData({
      showAnswer: true,
    });
  },

  // 重置测验结果统计
  resetQuizResult(total = 0) {
    this.setData({
      quizResult: {
        total: total,
        unknown: 0,
        fuzzy: 0,
        mastered: 0,
      } as QuizResultSummary,
    });
  },

  // 同步每日测验进度到本地存储，供其他页面使用
  syncDailyProgress(finished = false) {
    if (this.data.quizOptions.type !== 'today') {
      return;
    }
    updateDailyQuizSessionProgress({
      currentIndex: this.data.cardIndex,
      result: { ...this.data.quizResult, total: this.data.cardQueue.length },
      finished,
    });
  },

  // 测验结束，保存结果并跳转到结果页
  finishQuiz() {
    this.setData({
      quizResult: {
        ...this.data.quizResult,
        total: this.data.cardQueue.length,
      },
    });
    // 如果是每日测验，确保最后一次进度同步，标记为已完成
    if (this.data.quizOptions.type === 'today') {
      this.syncDailyProgress(true);
    }
    wx.setStorageSync('quizResult', JSON.stringify(this.data.quizResult));
    wx.redirectTo({
      url: `/package-card/quizResult/index?${jsonToUrlParam(this.data.quizOptions)}`,
    });
  },

  // 获取当前题目卡片
  getCurrentCard(cardIndex, cardQueue): (CardView & { tagText?: string }) | null {
    const tags = cardQueue[cardIndex]?.tags;
    const tagText = Array.isArray(tags) && tags.length > 0 ? '/ ' + tags.join('•') : '';
    return {
      ...cardQueue[cardIndex],
      tagText,
    };
  },

  // 构建测验队列
  buildQueue() {
    // 每日测验
    if (this.data.quizOptions.type === 'today') {
      const res = getDailyQuizSession(this.data.quizOptions);
      if (!res.success || !res.data) {
        wx.showToast({
          title: res.message || '测验题目加载失败',
          icon: 'none',
        });
        this.setData({
          cardQueue: [],
        });
        return;
      }
      // 加载已有的每日测验进度，继续未完成的测验
      this.setData({
        cardQueue: res.data.queue,
        cardIndex: res.data.currentIndex,
        currentCard: this.getCurrentCard(res.data.currentIndex, res.data.queue),
        quizResult: res.data.result,
      });

      // 如果测验已经完成，直接跳转到结果页
      if (res.data.finished) {
        this.finishQuiz();
        return;
      }
      // 否则继续测验，显示当前题目
      this.setData({
        showAnswer: false,
      });
      return;
    }

    // 自由测验，直接获取题目列表
    const res = getFreedomQuizQuestions(this.data.quizOptions);
    if (res.success && res.data) {
      this.setData({
        cardQueue: res.data,
        cardIndex: 0,
        currentCard: this.getCurrentCard(0, res.data),
        showAnswer: false,
      });
      this.resetQuizResult(this.data.cardQueue.length);
      return;
    }
    // 加载失败，清空队列并提示错误
    this.setData({
      cardQueue: [],
    });
    this.resetQuizResult(0);
    wx.showToast({
      title: res.message || '测验题目加载失败',
      icon: 'none',
    });
  },

  // 状态更新接口
  changeStatus(cardId: string | undefined, status: CardStatus) {
    if (!cardId) return;
    const res = updateCard({ id: cardId, status });
    if (!res.success) {
      wx.showToast({
        title: res.message || '状态更新失败',
        icon: 'none',
      });
    }
  },

  // 进入下一题
  nextQuestion() {
    if (this.data.cardIndex < this.data.cardQueue.length - 1) {
      this.setData({
        cardIndex: this.data.cardIndex + 1,
        showAnswer: false, // 切换到下一题时默认隐藏答案
        currentCard: this.getCurrentCard(this.data.cardIndex + 1, this.data.cardQueue),
      });
      this.syncDailyProgress(false);
    } else {
      this.finishQuiz();
    }
  },

  // 选择状态
  onQuiz(event: WechatMiniprogram.BaseEvent) {
    const status = event.currentTarget.dataset.status;
    switch (status) {
      case 'unknown':
        this.changeStatus(this.data.currentCard?.id, 'unknown');
        this.setData({
          'quizResult.unknown': this.data.quizResult.unknown + 1,
        });
        this.nextQuestion();
        break;
      case 'fuzzy':
        this.changeStatus(this.data.currentCard?.id, 'fuzzy');
        this.setData({
          'quizResult.fuzzy': this.data.quizResult.fuzzy + 1,
        });
        this.nextQuestion();
        break;
      case 'mastered':
        this.changeStatus(this.data.currentCard?.id, 'mastered');
        this.setData({
          'quizResult.mastered': this.data.quizResult.mastered + 1,
        });
        this.nextQuestion();
        break;
    }
  },

  onLoad(options) {
    if (options?.categoryId) {
      this.setData({
        'quizOptions.categoryId': options.categoryId,
      });
    }
    if (options?.mode) {
      this.setData({
        'quizOptions.mode': options.mode as quizQuery['mode'],
      });
    }
    if (options?.type) {
      this.setData({
        'quizOptions.type': options.type as quizQuery['type'],
      });
    }
    if (options?.limit) {
      this.setData({
        'quizOptions.limit': Number(options.limit) as quizQuery['limit'],
      });
    }
  },

  onReady() {
    // 组件准备好时构建测验队列，不放在onShow里是为了避免每次切换后台返回这个页面时都重置测验进度
    this.buildQueue();
  },
});
