import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Tidak ada file yang diunggah' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    
    // Bersihkan nama file agar tidak ada spasi atau karakter aneh
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filename = `${Date.now()}-${safeName}`
    
    // Pastikan folder public/uploads sudah ada
    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    const filePath = path.join(uploadDir, filename)
    fs.writeFileSync(filePath, buffer)

    // Kembalikan URL lokal
    return NextResponse.json({ url: `/uploads/${filename}` })
  } catch (err: any) {
    console.error('Error uploading file:', err)
    return NextResponse.json({ error: err.message || 'Gagal menyimpan file' }, { status: 500 })
  }
}
