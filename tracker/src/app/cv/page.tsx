import CvForm from './CvForm'

interface Props {
  searchParams: { title?: string; company?: string; jobId?: string }
}

export default function CvPage({ searchParams }: Props) {
  return <CvForm title={searchParams.title} company={searchParams.company} jobId={searchParams.jobId} />
}
