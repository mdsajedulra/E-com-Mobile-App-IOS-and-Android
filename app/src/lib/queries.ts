import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { app, store } from './api';
import type { Category, OrderDetail, OrderSummary, Product, Review } from './types';

export type ProductQuery = Record<string, string | number | boolean | undefined>;

type Page = { data: Product[]; total: number; totalPages: number };

export function useProducts(query: ProductQuery, enabled = true) {
  return useQuery({
    queryKey: ['products', query],
    queryFn: async () => (await store('products', { query: { per_page: 10, ...query }, withHeaders: true })) as Page,
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useInfiniteProducts(query: ProductQuery) {
  return useInfiniteQuery({
    queryKey: ['products-infinite', query],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      (await store('products', { query: { per_page: 20, ...query, page: pageParam }, withHeaders: true })) as Page & { page?: number },
    getNextPageParam: (last, all) => (all.length < last.totalPages ? all.length + 1 : undefined),
    staleTime: 5 * 60_000,
  });
}

export function useProduct(id: number | string) {
  return useQuery({
    queryKey: ['product', String(id)],
    queryFn: async () => (await store(`products/${id}`)) as Product,
    staleTime: 2 * 60_000,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await app('categories')) as Category[],
    staleTime: 30 * 60_000,
  });
}

export function useReviews(productId: number, enabled: boolean) {
  return useQuery({
    queryKey: ['reviews', productId],
    queryFn: async () => (await store('products/reviews', { query: { product_id: productId, per_page: 20 } })) as Review[],
    enabled,
    staleTime: 10 * 60_000,
  });
}

export function useOrders(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['orders'],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      (await app('orders', { query: { page: pageParam } })) as { orders: OrderSummary[]; page: number; total_pages: number },
    getNextPageParam: (last) => (last.page < last.total_pages ? last.page + 1 : undefined),
    enabled,
  });
}

export function useOrder(id: string, key?: string) {
  return useQuery({
    queryKey: ['order', id, key],
    queryFn: async () => (await app(`orders/${id}`, { query: { key } })) as OrderDetail,
  });
}
