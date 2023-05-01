export class Optionnal<T = unknown>{

    private static readonly EMPTY = new Optionnal<null>(null);

    public static empty(): Optionnal<null>{
        return Optionnal.EMPTY;
    }

    public static of<T>(value: T): Optionnal<T>{
        if(value == null){
            throw new Error("Value cannot be null");
        }
        return new Optionnal<T>(value);
    }

    public static ofNullable<T>(value: T): Optionnal<T>{
        return value == null ? Optionnal.empty() : new Optionnal<T>(value);
    }

    private readonly value: T;

    constructor(value: T){
        this.value = value;
    }

    public get(): T{
        if(this.isEmpty()){
            throw new Error("No value present");
        }
        return this.value;
    }

    public isPresent(): boolean{ return this.value != null; }
    public isEmpty(): boolean{ return this.value == null; }

    public map<U>(mapper: (value: T) => U): Optionnal<U>{
        if(this.isEmpty()){ return Optionnal.empty(); }
        return Optionnal.ofNullable(mapper(this.value));
    }

    public orElse(other: T): T{
        return this.isEmpty() ? other : this.value;
    }
}