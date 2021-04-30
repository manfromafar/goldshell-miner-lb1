export const minerconfig = {
        model: "simplenode",
        algo:   "scrypt",
        varity: 0x30,
        powerplan: [
            {
                plan: "HashRate",
                voltage: 810,
                freq: 850,
            },
            {
                plan: "Balance",
                voltage: 720,
                freq: 725,
            },
            {
                plan: "LowePower",
                voltage: 670,
                freq: 600,
            }
        ],
        powerdefault: "HashRate",
        temptarget: 65,
        tempwarn: 70,
        tempcutoff: 90
    };