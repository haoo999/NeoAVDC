import assert from 'node:assert/strict'
import test from 'node:test'
import { dmmCandidates, dmmCoverUrls, dmmSampleGroups } from './dmmCdn'
import { parseNumberFromFileName } from '../number/parseNumber'

test('dmmCandidates 有码字母番号按 5/6/4 位 padding 生成候选', () => {
  const cids = dmmCandidates('SSIS-001', null)
  assert.deepEqual(cids, ['ssis00001', 'ssis000001', 'ssis0001'])
})

test('dmmCandidates 长数字番号不补零到更短长度', () => {
  const cids = dmmCandidates('ABP-123456', null)
  assert.deepEqual(cids, ['abp123456'])
})

test('dmmCandidates 无码数字番号不生成 DMM cid', () => {
  const parsed = parseNumberFromFileName('12345-678.mp4')
  assert.deepEqual(dmmCandidates('12345-678', parsed), [])
})

test('dmmCandidates 非标准格式不生成', () => {
  assert.deepEqual(dmmCandidates('Vacation.24.12.25', null), [])
})

test('dmmCoverUrls 生成 pl.jpg 封面地址', () => {
  const urls = dmmCoverUrls('SSIS-001', null)
  assert.equal(
    urls[0],
    'https://pics.dmm.co.jp/digital/video/ssis00001/ssis00001pl.jpg'
  )
})

test('dmmSampleGroups 按 cid 分组返回样张', () => {
  const groups = dmmSampleGroups('SSIS-01', null)
  assert.ok(groups.length >= 1)
  assert.equal(groups[0].length, 10)
  assert.match(groups[0][0], /jp-1\.jpg$/)
  assert.match(groups[0][9], /jp-10\.jpg$/)
})
