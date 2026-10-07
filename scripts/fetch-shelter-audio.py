import pathlib
import sys
import json
import os
import shutil
import argparse
root = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / '.tools/audio'))
import yt_dlp
import imageio_ffmpeg
ffmpeg_directory = root / '.tools/audio-bin'
ffmpeg_directory.mkdir(parents=True, exist_ok=True)
if not (ffmpeg_directory / 'ffmpeg.exe').exists():
    shutil.copyfile(imageio_ffmpeg.get_ffmpeg_exe(), ffmpeg_directory / 'ffmpeg.exe')
os.environ['PATH'] = str(root / '.tools/audio-bin') + os.pathsep + os.environ.get('PATH', '')
folder = root / 'verification/audio-reference'
folder.mkdir(parents=True, exist_ok=True)
arguments = argparse.ArgumentParser(description='Fetch the user-supplied Shelter gameplay reference excerpt.')
arguments.add_argument('--download', action='store_true')
arguments.add_argument('--start', type=float, default=20)
arguments.add_argument('--end', type=float, default=180)
args = arguments.parse_args()
if args.start < 0 or args.end <= args.start or args.end - args.start > 180:
    arguments.error('Choose an excerpt of at most 180 seconds with 0 <= start < end.')
options = {'format': 'bestaudio/best', 'outtmpl': str(folder / 'shelter-reference.%(ext)s'), 'noplaylist': True,
           'ffmpeg_location': str(root / '.tools/audio-bin'), 'socket_timeout': 20, 'retries': 1,
           'force_keyframes_at_cuts': True,
           'external_downloader_args': {'ffmpeg_o': ['-c:a', 'libopus', '-b:a', '192k', '-loglevel', 'error']}}
if args.download:
    options['download_ranges'] = yt_dlp.utils.download_range_func(None, [(args.start, args.end)])
    options['outtmpl'] = str(folder / ('reference-accurate-%g-%g.%%(ext)s' % (args.start, args.end)))
    options['js_runtimes'] = {'node': {}}
with yt_dlp.YoutubeDL(options) as downloader:
    info = downloader.extract_info('https://www.youtube.com/watch?v=w5bPBMt6yJ4', download=args.download)
    summary = {key: info.get(key) for key in ('id', 'title', 'duration', 'chapters')}
    print(json.dumps(summary))
    (folder / 'reference.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
