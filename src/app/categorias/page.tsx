import { CadastroList } from "@/components/cadastro-list";
export default function Categorias(){return <CadastroList entity="categorias" title="Categorias" description="Organize seu catálogo por categorias." fields={[{key:"name",label:"Nome"}]}/>;}
