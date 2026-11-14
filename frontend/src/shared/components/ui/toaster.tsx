import { useToast } from "@/shared/hooks/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/shared/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider duration={5000}>
      {toasts.map(function (
        { id, title, description, action, variant, belowHeader, ...props }: ReturnType<typeof useToast>['toasts'][number]
      ) {
        return (
          <Toast 
            key={id} 
            data-below-header={belowHeader || undefined}
            variant={variant} 
            title={title} 
            description={description} 
            {...props}
          >
            <div className="space-y-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport className="notification-viewport" />
    </ToastProvider>
  )
}

