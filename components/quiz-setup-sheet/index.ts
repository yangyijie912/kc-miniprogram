import type { quizQuery } from '@/types/quiz';
import { getWindowStyles } from '@/utils/layout';
import { dailyQuizLimit } from '@/services/quizService';

// 计算测验模式选项的文本描述
function getPracticeModeText(mode: quizQuery['mode']): string {
  switch (mode) {
    case 'unknown':
      return '只测不会';
    case 'all':
      return '全部随机';
    default:
      return '复习模式';
  }
}

Component({
  properties: {
    open: {
      type: Boolean,
      value: false,
    },
    categoryId: {
      type: String,
      value: '',
    },
  },

  data: {
    selectedPracticeMode: 'review' as quizQuery['mode'],
    practiceModeText: getPracticeModeText('review'),
    selectedQuizType: 'freedom' as quizQuery['type'],
    selectedLimit: 10 as quizQuery['limit'],
    customLimit: null as number | null,
    windowStyles: {
      maxHeight: 0,
    },
    dailyQuizLimit,
  },

  methods: {
    // 关闭测验设置界面
    closeQuiz() {
      this.triggerEvent('close');
    },

    // 开始测验，触发父组件的事件并传递选项参数
    startQuiz() {
      this.triggerEvent('start', {
        mode: this.data.selectedPracticeMode,
        type: this.data.selectedQuizType,
        limit: this.data.selectedLimit,
      } as quizQuery);
    },

    // 选择测验类型
    onSelectQuizType(event: WechatMiniprogram.BaseEvent) {
      const type = event.currentTarget.dataset.type as quizQuery['type'];
      this.setData({
        selectedQuizType: type,
      });
    },

    // 选择练习模式
    onSelectPracticeMode(event: WechatMiniprogram.BaseEvent) {
      const mode = event.currentTarget.dataset.mode as quizQuery['mode'];
      this.setData({
        selectedPracticeMode: mode,
        practiceModeText: getPracticeModeText(mode),
      });
    },

    // 选择练习数量
    onSelectLimit(event: WechatMiniprogram.BaseEvent) {
      const limit = event.currentTarget.dataset.limit as number;
      this.setData({
        selectedLimit: limit,
      });
    },

    // 自定义测验题目数量输入处理
    onCustomLimitInput(event: WechatMiniprogram.Input) {
      const value = event.detail.value;
      const numericValue = parseInt(value, 10);

      if (!isNaN(numericValue) && numericValue > 0) {
        this.setData({
          customLimit: numericValue,
          selectedLimit: numericValue,
        });
      } else {
        this.setData({
          customLimit: null,
        });
      }
    },
  },

  lifetimes: {
    attached() {
      // 在组件附加到页面时获取窗口样式并设置CSS变量
      const styles = getWindowStyles();
      this.setData({
        windowStyles: {
          maxHeight: styles.maxHeight,
        },
      });
    },
  },
});
