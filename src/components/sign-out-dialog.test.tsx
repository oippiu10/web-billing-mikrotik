import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SignOutDialog } from './sign-out-dialog'

const navigate = vi.fn()
const reset = vi.fn()

const MOCK_HREF = 'https://app.test/dashboard?tab=1'

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    auth: { reset },
  }),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => navigate,
    useLocation: () => ({ href: MOCK_HREF }),
  }
})

const postMock = vi.fn()

vi.mock('@/lib/api', () => ({
  api: {
    post: (...args: any[]) => postMock(...args),
  },
  default: {
    post: (...args: any[]) => postMock(...args),
  },
}))

describe('SignOutDialog', () => {
  const queryClient = new QueryClient()

  beforeEach(() => {
    vi.clearAllMocks()
    postMock.mockResolvedValue({ data: { success: true } })
  })

  it('calls auth.reset and navigates to sign-in with current location as redirect', async () => {
    const { getByRole } = await render(
      <QueryClientProvider client={queryClient}>
        <SignOutDialog open onOpenChange={vi.fn()} />
      </QueryClientProvider>
    )

    await userEvent.click(getByRole('button', { name: /^Sign out$/i }))

    await vi.waitFor(() => expect(reset).toHaveBeenCalledOnce())
    expect(navigate).toHaveBeenCalledWith({
      to: '/sign-in',
      search: { redirect: MOCK_HREF },
      replace: true,
    })
  })

  it('does not call reset or navigate when Cancel is clicked', async () => {
    const { getByRole } = await render(
      <QueryClientProvider client={queryClient}>
        <SignOutDialog open onOpenChange={vi.fn()} />
      </QueryClientProvider>
    )

    await userEvent.click(getByRole('button', { name: /^Cancel$/i }))

    expect(reset).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })
})
