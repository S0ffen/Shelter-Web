"""Read-only CSNZ NAR inspection. Format reference: github.com/SmilexGamer/NARTools.
Extracts only explicitly selected files into the workspace, never modifies the game.
"""
import argparse, bz2, json, pathlib, struct, re

def entries(path):
    with path.open('rb') as f:
        assert f.read(8) == b'NAR\x00\x00\x00\x00\x01'
        f.seek(-8, 2)
        size = struct.unpack('<I', f.read(4))[0] ^ 0x4076551F
        f.seek(-8-size, 2)
        key = bytes.fromhex('195b7b2c655e79256e4b0721627f0029')
        header = bz2.decompress(bytes(b ^ key[i%16] for i,b in enumerate(f.read(size))))
    count = struct.unpack_from('<I', header, 16)[0]; offset = 20
    result=[]
    for _ in range(count):
        length = struct.unpack_from('<H', header, offset)[0]
        name = header[offset+2:offset+2+length].decode('euc-kr')
        kind, start, stored, size, stamp, crc = struct.unpack_from('<6I', header, offset+2+length)
        result.append(dict(archive=str(path),name=name,kind=kind,offset=start,stored=stored,size=size,crc=crc))
        offset += 26+length
    return result

def extract(entry):
    with open(entry['archive'],'rb') as f:
        f.seek(entry['offset']); data=f.read(entry['stored'])
    if entry['kind']:
        path=entry['name'].encode('euc-kr'); seed=0
        for b in path: seed=((seed*1000003)^b)&0xffffffff
        seed ^= len(path)
        key=[]
        for _ in range(16):
            seed=(seed*1103515245+12345)&0xffffffff;key.append(seed&255)
        data=bytes(b^key[i%16] for i,b in enumerate(data))
    if entry['kind']==2:
        out=bytearray();i=0
        while i<len(data):
            b=data[i];i+=1;op=b>>5;n=b&31
            if not op: out.extend(data[i:i+n+1]);i+=n+1
            else:
                if op==7:op+=data[i];i+=1
                op+=2;distance=(n<<8)+data[i]+1;i+=1
                for _ in range(op):out.append(out[-distance])
        data=bytes(out)
    assert len(data)==entry['size'], (entry['name'],len(data),entry['size'])
    return data

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('root');parser.add_argument('--match',default=r'(zsh|shelter|harvest|gather|collect|pickaxe|hammer|material)');parser.add_argument('--extract',action='store_true');args=parser.parse_args()
    selected=[]
    for archive in sorted(pathlib.Path(args.root).glob('*.nar')):
        for entry in entries(archive):
            if re.search(args.match,entry['name'],re.I):selected.append(entry)
    out=pathlib.Path('verification/csnz-audio');out.mkdir(parents=True,exist_ok=True)
    (out/'index.json').write_text(json.dumps(selected,indent=2),encoding='utf8')
    for entry in selected:
        print(entry['archive'].split('\\')[-1],entry['name'],entry['size'])
        if args.extract:
            target=out/pathlib.Path(entry['name'].replace('\\','/')).name
            if target.suffix.lower() in ('.wav','.mp3','.ogg'):target.write_bytes(extract(entry))
