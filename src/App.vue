<script setup lang="ts">
import { RouterView, RouterLink, useRoute } from 'vue-router';
import {
  MapPin,
  Clapperboard,
  Map,
  Settings,
  HelpCircle,
  FileVideo,
  Route as RouteIcon,
  Mountain,
} from 'lucide-vue-next';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar';

const route = useRoute();

// Navigation items with nested structure
const navItems = [
  {
    title: 'Animation',
    icon: FileVideo,
    items: [
      {
        title: 'Basic Animation',
        url: '/',
        icon: MapPin,
      },
      {
        title: 'Keyframe Animation',
        url: '/keyframe',
        icon: Clapperboard,
      },
    ],
  },
  {
    title: 'Map Tools',
    icon: Map,
    items: [
      {
        title: 'Route Viewer',
        url: '#',
        icon: RouteIcon,
      },
      {
        title: 'Elevation Profile',
        url: '#',
        icon: Mountain,
      },
    ],
  },
];

const isActiveRoute = (url: string) => {
  return route.path === url;
};
</script>

<template>
  <SidebarProvider>
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" as-child>
              <RouterLink to="/">
                <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Map class="size-4" />
                </div>
                <div class="grid flex-1 text-left text-sm leading-tight">
                  <span class="truncate font-semibold">GPX Animation</span>
                  <span class="truncate text-xs">Route Visualizer</span>
                </div>
              </RouterLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup v-for="group in navItems" :key="group.title">
          <SidebarGroupLabel>{{ group.title }}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem v-for="item in group.items" :key="item.title">
                <SidebarMenuButton
                  as-child
                  :is-active="isActiveRoute(item.url)"
                >
                  <RouterLink :to="item.url">
                    <component :is="item.icon" />
                    <span>{{ item.title }}</span>
                  </RouterLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <!-- Help & Settings Group -->
        <SidebarGroup class="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton as-child>
                  <a href="#">
                    <Settings />
                    <span>Settings</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton as-child>
                  <a href="#">
                    <HelpCircle />
                    <span>Help</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>

    <SidebarInset>
      <header class="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger class="-ml-1" />
        <div class="h-4 w-px bg-border" />
        <span class="text-sm font-medium">{{ route.name }}</span>
      </header>
      <main class="flex-1 overflow-hidden">
        <RouterView />
      </main>
    </SidebarInset>
  </SidebarProvider>
</template>