// Frame of the screens without a session: login, forgot password and reset password.
export function AuthFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="hidden flex-col justify-between bg-[#0f3d24] p-14 text-white lg:flex">
        <p className="text-xl font-semibold">
          Agrosalas <span className="font-normal text-[#a7e3bd]">Admin</span>
        </p>
        <div className="space-y-3">
          <p className="text-3xl leading-tight font-semibold">Panel interno de Agrosalas Perú</p>
          <p className="text-[#cfe8d8]">Planilla, inventario, compras y ventas.</p>
        </div>
        <p className="text-sm text-[#a7e3bd]">Acceso solo para personal autorizado</p>
      </div>
      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm space-y-5">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {children}
        </div>
      </div>
    </main>
  )
}
