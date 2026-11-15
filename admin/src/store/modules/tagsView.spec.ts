/**
 * 标签页 Store：关闭左/右侧标签的边界与固定标签保护。
 *
 * 这两个方法是纯数组运算，但很容易写错三件事：
 * 1) 固定（affix）标签不能被关；
 * 2) keep-alive 缓存名单要跟着移除，否则标签没了组件还被缓存；
 * 3) 目标在最左/最右/找不到时必须是 no-op。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { useTagsViewStore, type TagView } from '@/store/modules/tagsView';

function view(name: string, affix = false): TagView {
  return { name, path: `/${name}`, fullPath: `/${name}`, title: name, affix };
}

/** 固定首页 + A/B/C/D 四个普通标签，缓存名单与之一一对应 */
function seed(store: ReturnType<typeof useTagsViewStore>): void {
  store.visitedViews = [view('Home', true), view('A'), view('B'), view('C'), view('D')];
  store.cachedViews = ['Home', 'A', 'B', 'C', 'D'];
}

describe('tagsView store - 关闭左/右侧标签', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('关闭左侧：只移除目标左侧的非固定标签，目标与其右侧保留', () => {
    const store = useTagsViewStore();
    seed(store);

    store.delLeftViews(view('C'));

    expect(store.visitedViews.map((v) => v.name)).toEqual(['Home', 'C', 'D']);
    expect(store.cachedViews).toEqual(['Home', 'C', 'D']);
  });

  it('关闭右侧：只移除目标右侧的非固定标签，目标与其左侧保留', () => {
    const store = useTagsViewStore();
    seed(store);

    store.delRightViews(view('B'));

    expect(store.visitedViews.map((v) => v.name)).toEqual(['Home', 'A', 'B']);
    expect(store.cachedViews).toEqual(['Home', 'A', 'B']);
  });

  it('左侧全是固定标签时不动，且固定标签永远不被移除', () => {
    const store = useTagsViewStore();
    store.visitedViews = [view('Home', true), view('Fixed', true), view('A')];
    store.cachedViews = ['Home', 'Fixed', 'A'];

    store.delLeftViews(view('A'));

    expect(store.visitedViews.map((v) => v.name)).toEqual(['Home', 'Fixed', 'A']);
    expect(store.cachedViews).toEqual(['Home', 'Fixed', 'A']);
  });

  it('目标在最左 / 最右 / 不存在时均为 no-op', () => {
    const store = useTagsViewStore();
    seed(store);

    store.delLeftViews(view('Home', true));
    store.delRightViews(view('D'));
    store.delLeftViews(view('NotFound'));
    store.delRightViews(view('NotFound'));

    expect(store.visitedViews.map((v) => v.name)).toEqual(['Home', 'A', 'B', 'C', 'D']);
    expect(store.cachedViews).toEqual(['Home', 'A', 'B', 'C', 'D']);
  });
});
