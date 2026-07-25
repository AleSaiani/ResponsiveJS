import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import DemoFrame from './components/DemoFrame.vue';
import ResizeMe from './components/ResizeMe.vue';
import Demo from './components/Demo.vue';
import PlanePlot from './components/PlanePlot.vue';
import TableToCards from './components/TableToCards.vue';
import FrameworkDemo from './components/FrameworkDemo.vue';
import Wordmark from './components/Wordmark.vue';
import './custom.css';

// Components are global so any markdown page can drop a live demo in.
export default {
    extends: DefaultTheme,
    enhanceApp({ app }) {
        app.component('DemoFrame', DemoFrame);
        app.component('ResizeMe', ResizeMe);
        app.component('Demo', Demo);
        app.component('PlanePlot', PlanePlot);
        app.component('TableToCards', TableToCards);
        app.component('FrameworkDemo', FrameworkDemo);
    },
    Layout: Wordmark,
} satisfies Theme;
