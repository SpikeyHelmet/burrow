import * as assert from 'assert';
import { transformToFullName } from "./ABI";
import { compile } from "./compile";

const source = `
pragma solidity >=0.0.0;

contract foo {
	uint foobar;

	function addFoobar(uint n, bool b) public {
	  if (b) {
		  foobar += n;
	  }
	}

	function getFoobar() public view returns (uint n) {
		n = foobar;
	}
}
`

describe('ABI helpers', () => {
  it('Can extract correct names from ABI', () => {
    const {abi} = compile(source, 'foo')
    console.log(JSON.stringify(abi))
    assert.strictEqual(transformToFullName(abi[0]), "addFoobar(uint256,bool)")
  })

  it('Derive Typescript contract type from ABI', () => {
    // This is a nearly-working proof of concept for generating a contract's type definition
    // directly from the JSON ABI...

    const abiConst = [
      {
        "name": "addFoobar",
        "inputs": [
          {"internalType": "uint256", "name": "n", "type": "uint256"},
          {"internalType": "bool", "name": "b", "type": "bool"}
        ],
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "name": "getFoobar",
        "inputs": [
          {"internalType": "address", "name": "addr", "type": "address"}
        ],
        "outputs": [{"internalType": "uint256", "name": "n", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      },
    ] as const;

    type ABI = typeof abiConst

    type ABIIndex = number & keyof ABI

    type Func = ABI[ABIIndex]

    type FuncName = Func['name']

    type FuncOfName<T, Name extends FuncName> = T extends { name: Name; type: 'function' } ? T : never;

    // type Picker<name extends FuncName> = FuncByName<ABI[number], name>

    type Values<T> = T[keyof T]

    type PickFuncByName<name extends FuncName> = Values<{
      [i in ABIIndex]: FuncOfName<ABI[i], name>
    }>

    type FunctionInputs<T extends FuncName> = PickFuncByName<T>["inputs"]

    type FunctionOutputs<T extends FuncName> = PickFuncByName<T>["outputs"]

    type Address = string

    type Type<T> =
      T extends 'uint256' ? number :
        T extends 'bool' ? boolean :
          T extends 'address' ? Address :
            never

    // **mumble** something about distribution
    type PickValue<T, U> = U extends keyof T ? Values<Pick<T, U>> : never;

    type TypesOf<T> = { [k in keyof T]: Type<PickValue<T[k], 'type'>> }

    const getFoobarABI: PickFuncByName<'getFoobar'> =
      {
        "name": "getFoobar",
        "inputs": [
          {"internalType": "address", "name": "addr", "type": "address"}
        ],
        "outputs": [{"internalType": "uint256", "name": "n", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      }

    const addFoobarInputs: FunctionInputs<'addFoobar'> = [
      {"internalType": "uint256", "name": "n", "type": "uint256"},
      {"internalType": "bool", "name": "b", "type": "bool"},
    ]

    const addFoobarArgs: TypesOf<FunctionInputs<'addFoobar'>> = [1, true]
    const getFoobarArgs: TypesOf<FunctionInputs<'getFoobar'>> = ["address"]

    type Args<Name extends FuncName> = TypesOf<FunctionInputs<Name>>

    // Everything above this line compiles, which make me think the following should work, however...

    // I think this is a bug: https://github.com/microsoft/TypeScript/issues/29919
    // This line is a compiler error: TS2370: A rest parameter must be of an array type.
    // Uncomment to experiment further
    // type ContractFunc<Name extends FuncName> = (...args: Args<Name>) => TypesOf<FunctionOutputs<Name>>;
    // type ContractFunc<Name extends FuncName> = (...args: any[]) => TypesOf<FunctionOutputs<Name>>

    // Definition below reveals a bit more about source of problem, Args<Name> is missing property [Symbol.iterator]
    type ContractFunc<A extends readonly any[], Name extends FuncName> = (...args: A) => TypesOf<FunctionOutputs<Name>>;

    type Contract = { [Name in FuncName]: ContractFunc<Args<Name>, Name> }

    // Note: my IDE actually actually seem to be type-checking these correctly
    // despite the compiler error on the function a    type ContractFunc<Name extends FuncName> = (...args: Args<Name>) => TypesOf<FunctionOutputs<Name>>;rg spread above! So close!
    const contract: Contract = {
      // uint256, bool => ()
      addFoobar: (n: number, b: boolean) => [],
      // address => uint256
      getFoobar: (n: Address) => [3],
    }

  })
})
