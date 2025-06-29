declare module 'unique-selector' {
  export interface UniqueOptions {
    selectorTypes?: Array<'id' | 'class' | 'tag' | 'attribute' | 'nthchild'>;
    excludeRegex?: RegExp;
    preferredAttr?: string;
  }

  export function unique(element: Element, options?: UniqueOptions): string;
}