export interface Keyword {
    id: string;
    name: string;
    keyword: string;
    status: 'active' | 'inactive';
    created_at: string;
}

export interface KeywordPagination {
    current_page: number;
    data: Keyword[];
    first_page_url: string;
    from: number;
    last_page: number;
    last_page_url: string;
    links: {
        url: string | null;
        label: string;
        active: boolean;
    }[];
    next_page_url: string | null;
    path: string;
    per_page: number;
    prev_page_url: string | null;
    to: number;
    total: number;
}
