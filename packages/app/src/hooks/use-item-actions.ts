import type { Item } from '@paramhub/types';
import { useAppDispatch } from '../state/index.js';

interface UseItemActionsReturn {
  openItem: (item: Item) => void;
}

export function useItemActions(): UseItemActionsReturn {
  const dispatch = useAppDispatch();

  const openItem = (item: Item) => {
    dispatch({ type: 'SET_SELECTED_ITEM', item });
    dispatch({ type: 'SET_VIEW', view: 'detail' });
    dispatch({ type: 'SET_FOCUS', zone: 'detail' });
  };

  return { openItem };
}
