import { createRouter, createWebHistory } from "vue-router";
import HomePage from "../pages/HomePage.vue";
import SupportPage from "../pages/SupportPage.vue";
import PrivacyPage from "../pages/PrivacyPage.vue";
import TermsPage from "../pages/TermsPage.vue";

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior() {
    return { top: 0 };
  },
  routes: [
    {
      path: "/",
      name: "home",
      component: HomePage,
      meta: {
        title: "Glosc Chat | 本地优先的多模型 AI 聊天客户端"
      }
    },
    {
      path: "/support",
      name: "support",
      component: SupportPage,
      meta: {
        title: "技术支持 | Glosc Chat"
      }
    },
    {
      path: "/privacy",
      name: "privacy",
      component: PrivacyPage,
      meta: {
        title: "隐私政策 | Glosc Chat"
      }
    },
    {
      path: "/terms",
      name: "terms",
      component: TermsPage,
      meta: {
        title: "服务条款 | Glosc Chat"
      }
    }
  ]
});

router.afterEach((to) => {
  document.title = String(to.meta.title ?? "Glosc Chat");
});
