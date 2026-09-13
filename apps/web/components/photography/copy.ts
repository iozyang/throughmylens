import type { Locale } from "./types";

export const copy = {
  zh: {
    nav: { work: "作品", projects: "项目", films: "影像", places: "地点", about: "关于" },
    selectedWork: "精选作品", exploreWork: "浏览作品",
    selectedProjects: "精选项目", exploreProjects: "浏览项目",
    places: "地点", explorePlaces: "探索地点",
    menu: "菜单", close: "关闭", closeViewer: "关闭全屏照片",
    language: "Switch to English", skip: "跳至精选作品",
    pause: "暂停动态", play: "恢复动态", hint: "轻触查看信息 · 长按放大",
    view: "查看照片", details: "照片信息", fullscreen: "全屏查看",
    noParameters: "未提供拍摄参数", email: "邮件", credits: "演示图片来源",
    demo: "部分选片及项目为演示内容，仅供本地预览。",
    soon: "此部分正在准备中。", home: "返回首页", collection: "作品集",
    viewerHelp: "按 Escape 关闭照片，返回原来的浏览位置。",
  },
  en: {
    nav: { work: "Work", projects: "Projects", films: "Films", places: "Places", about: "About" },
    selectedWork: "Selected Work", exploreWork: "Explore Work",
    selectedProjects: "Selected Projects", exploreProjects: "Explore Projects",
    places: "Places", explorePlaces: "Explore Places",
    menu: "Menu", close: "Close", closeViewer: "Close fullscreen photograph",
    language: "切换到简体中文", skip: "Skip to selected work",
    pause: "Pause motion", play: "Resume motion", hint: "Tap for details · Hold to view",
    view: "View photograph", details: "Photograph details", fullscreen: "View fullscreen",
    noParameters: "Camera settings not supplied", email: "Email", credits: "Demo image credits",
    demo: "Includes demo photographs and projects for local preview.",
    soon: "This collection is being prepared.", home: "Back to home", collection: "Collection",
    viewerHelp: "Press Escape to close and return to the photographs.",
  },
} satisfies Record<Locale, object>;
