(function (root) {
  'use strict';

  var FILES = Object.freeze([
    {
      name: 'EchoStageDemo/README.md',
      content: '# Echo Stage 开发示例\n\n这是一个不含二进制素材的最小 `echo-stage/v1` 游戏目录。\n\n1. 解开 `EchoStageDemo.tar`；\n2. 在回声剧场中选择“选择目录”；\n3. 选择解压后的 `EchoStageDemo` 文件夹。\n\n入口配置位于 `game.json`，剧情位于 `scenario/main.echo`。你可以直接修改标题、对白与分支；需要图片或音频时，在 `assets` 中声明相对路径，并把对应文件放进游戏目录。\n'
    },
    {
      name: 'EchoStageDemo/game.json',
      content: '{\n  "format": "echo-stage/v1",\n  "id": "com.example.echo-stage-demo",\n  "title": "站台上的回声",\n  "entry": "scenario/main.echo",\n  "assets": {}\n}\n'
    },
    {
      name: 'EchoStageDemo/scenario/main.echo',
      content: '@speaker 遥\n@say 如果离别一定会发生，记住是否只是延迟失去？\n@choice 记住让相遇继续 => remember | 遗忘也可能是一种温柔 => release\n\n@label remember\n@set answer = memory\n@jump ending\n\n@label release\n@set answer = release\n\n@label ending\n@if answer == memory -> memory_end\n@end 潮汐 | 我们没有留下彼此，却为彼此留出了继续生活的位置。\n\n@label memory_end\n@end 余响 | 被记住并不等于被留住，但那一刻从此参与了我们的选择。\n'
    }
  ]);

  function utf8Size(value) {
    return new TextEncoder().encode(value).byteLength;
  }

  function textField(value, length) {
    if (!/^[\x00-\x7f]*$/.test(value) || value.length > length) throw new Error('Invalid TAR text field');
    return value + '\0'.repeat(length - value.length);
  }

  function octalField(value, length) {
    var encoded = Math.trunc(value).toString(8);
    if (encoded.length > length - 1) throw new Error('Invalid TAR number field');
    return encoded.padStart(length - 1, '0') + '\0';
  }

  function headerFor(name, size) {
    var header = '';
    header += textField(name, 100);
    header += octalField(420, 8);
    header += octalField(0, 8);
    header += octalField(0, 8);
    header += octalField(size, 12);
    header += octalField(0, 12);
    header += ' '.repeat(8);
    header += '0';
    header += '\0'.repeat(100);
    header += 'ustar\0';
    header += '00';
    header += textField('echo-stage', 32);
    header += textField('echo-stage', 32);
    header += octalField(0, 8);
    header += octalField(0, 8);
    header += '\0'.repeat(155);
    header += '\0'.repeat(12);
    if (header.length !== 512) throw new Error('Invalid TAR header length');

    var checksum = 0;
    for (var index = 0; index < header.length; index++) checksum += header.charCodeAt(index);
    var checksumField = checksum.toString(8).padStart(6, '0') + '\0 ';
    return header.slice(0, 148) + checksumField + header.slice(156);
  }

  function buildFiles(files) {
    var archive = '';
    files.forEach(function (file) {
      var size = utf8Size(file.content);
      archive += headerFor(file.name, size);
      archive += file.content;
      archive += '\0'.repeat((512 - (size % 512)) % 512);
    });
    return archive + '\0'.repeat(1024);
  }

  function build() { return buildFiles(FILES); }

  root.EchoStageDemoArchive = Object.freeze({
    filename: 'EchoStageDemo.tar',
    mimeType: 'application/x-tar',
    files: FILES,
    build: build,
    buildFiles: buildFiles
  });
})(globalThis);
