export interface Candle {
    date: number,
    open: number,
    high: number,
    low: number,
    close: number,
    volume: number
}

export function isCandle(object: any): object is Candle {
    return (
        typeof object === 'object' &&
        'date' in object &&
        'open' in object &&
        'high' in object &&
        'low' in object &&
        'close' in object &&
        'volume' in object &&
        typeof object.date === 'number' &&
        typeof object.open === 'number' &&
        typeof object.high === 'number' &&
        typeof object.low === 'number' &&
        typeof object.close === 'number' &&
        typeof object.volume === 'number'
    );
}