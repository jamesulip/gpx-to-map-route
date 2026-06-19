import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Basic Animation',
    component: () => import('../pages/Home.vue'),
    meta: { title: 'GPX Animation' },
  },
  {
    path: '/keyframe',
    name: 'Keyframe Animation',
    component: () => import('../pages/KeyframeAnimation.vue'),
    meta: { title: 'Keyframe Animation' },
  },
  {
    path:'/keyframe-editor',
    name: 'Keyframe Editor',
    component: () => import('../pages/KeyframeAnimationSimple.vue'),
    meta: { title: 'Keyframe Editor' },
  },
  {
    path: '/mapbox-simple',
    name: 'Mapbox Simple',
    component: () => import('../pages/MapboxSimple.vue'),
    meta: { title: 'Mapbox Simple' },
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Update document title on navigation
router.beforeEach((to, _from, next) => {
  document.title = (to.meta.title as string) || 'GPX to Map Route';
  next();
});

export default router;
